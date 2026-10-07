// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changeInvitationCapacity, getInvitationById, removeInvitationGuest, updateInvitation, updateInvitationGuestName } from '../api/invitationService';
import type { Invitation } from '../model/invitation.types';
import { InvitationDetailPage } from './InvitationDetailPage';

vi.mock('../api/invitationService', () => ({
  getInvitationById: vi.fn(), updateInvitation: vi.fn(), changeInvitationCapacity: vi.fn(),
  updateInvitationEditOverride: vi.fn(), updateInvitationGuestName: vi.fn(),
  removeInvitationGuest: vi.fn(), restoreInvitationReplacement: vi.fn(),
  archiveInvitation: vi.fn(), restoreInvitation: vi.fn(),
}));
vi.mock('../../../shared/notifications/notify', () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../model/publicInvitationUrl', () => ({ getPublicInvitationUrl: (id: string) => `https://boda.example/invitacion/${id}` }));

const base: Invitation = {
  id: 'CS7H4K2P', version: 'v1', displayName: 'Cassandra & Rubén', maxGuests: 2,
  replacementsAllowed: true, rsvpStatus: 'confirmed', message: 'Gracias',
  isArchived: false, archivedAt: null, updatedAt: '2026-09-20T18:07:00Z',
  editOverrideUntil: null,
  guests: [
    { name: 'Cassandra Us Hernandez', shortName: 'Cassandra', type: 'known', attending: true },
    { name: '', shortName: 'Acompañante', type: 'open', attending: false },
  ],
};
function mount(overrides: Partial<Invitation> = {}) {
  const invitation = { ...base, ...overrides };
  vi.mocked(getInvitationById).mockResolvedValue(invitation);
  render(<MemoryRouter initialEntries={['/invitaciones/CS7H4K2P']}><Routes><Route path="/invitaciones/:id" element={<InvitationDetailPage />} /></Routes></MemoryRouter>);
  return screen.findByRole('heading', { name: 'Personas (2)' });
}
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
afterEach(cleanup);

describe('detalle de la invitación', () => {
  const cardTitles = () => Array.from(document.querySelectorAll('.invitation-detail__card-slot .invitation-detail__section h2'), (heading) => heading.textContent);

  it('reordena tarjetas con los controles y conserva el orden al volver a abrir', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Mover Personas abajo' }));
    expect(cardTitles()).toEqual(['Datos de la invitación', 'Personas (2)', 'Administración']);
    expect(JSON.parse(localStorage.getItem('boda-admin:invitation-detail-card-order:v1') || 'null')).toEqual(['data', 'people', 'admin']);
    cleanup();
    await mount();
    expect(cardTitles()).toEqual(['Datos de la invitación', 'Personas (2)', 'Administración']);
    expect(screen.getByLabelText('Resumen de la invitación').compareDocumentPosition(screen.getByRole('region', { name: 'Datos de la invitación' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('mueve la tarjeta con el cursor y abre espacio antes de soltarla', async () => {
    await mount();
    const slots = Array.from(document.querySelectorAll<HTMLElement>('.invitation-detail__card-slot'));
    slots.forEach((slot, index) => vi.spyOn(slot, 'getBoundingClientRect').mockReturnValue({ top: index * 116, bottom: index * 116 + 100, height: 100 } as DOMRect));
    const admin = screen.getByRole('region', { name: 'Administración' });
    fireEvent.pointerDown(admin, { pointerId: 1, pointerType: 'mouse', button: 0, clientY: 282 });
    fireEvent.pointerMove(admin.parentElement as HTMLElement, { pointerId: 1, pointerType: 'mouse', clientY: 20 });
    expect(admin.parentElement?.classList.contains('is-dragging')).toBe(true);
    expect(screen.getByRole('region', { name: 'Personas (2)' }).parentElement?.classList.contains('is-drop-before')).toBe(true);
    fireEvent.pointerUp(admin.parentElement as HTMLElement, { pointerId: 1, pointerType: 'mouse', clientY: 20 });
    expect(cardTitles()).toEqual(['Administración', 'Personas (2)', 'Datos de la invitación']);
    expect(screen.getByLabelText('Resumen de la invitación').compareDocumentPosition(admin) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([
    ['pending', 'Pendiente'], ['confirmed', 'Confirmada'], ['declined', 'Declinada'], ['partial', 'Parcial'],
  ] as const)('muestra el RSVP %s una sola vez', async (rsvpStatus, label) => {
    await mount({ rsvpStatus });
    expect(screen.getByRole('heading', { name: 'Detalles de la invitación' })).toBeTruthy();
    expect(screen.getAllByText(label)).toHaveLength(1);
    expect(screen.getAllByText('Cassandra & Rubén')).toHaveLength(1);
    expect(screen.getAllByText('CS7H4K2P')).toHaveLength(1);
    expect(screen.getAllByText('2 lugares')).toHaveLength(1);
    expect(screen.getAllByText('Gracias')).toHaveLength(1);
    expect(screen.queryByText('Información general')).toBeNull();
  });

  it('presenta invitados, lugar sin nombre, permisos y estado administrativo', async () => {
    await mount();
    const people = screen.getByRole('region', { name: 'Personas (2)' });
    expect(within(people).getByText('Cassandra Us Hernandez')).toBeTruthy();
    expect(within(people).getByText('Lugar sin asignar')).toBeTruthy();
    expect(within(people).getByText('Asiste')).toBeTruthy();
    expect(within(people).getByText('No asiste')).toBeTruthy();
    const data = screen.getByRole('region', { name: 'Datos de la invitación' });
    expect(within(data).getByText('Permitidas')).toBeTruthy();
    const admin = screen.getByRole('region', { name: 'Administración' });
    expect(within(admin).getByText('Sin permiso')).toBeTruthy();
    expect(within(admin).getByText('Activa')).toBeTruthy();
    expect(within(admin).getByRole('button', { name: 'Archivar invitación' })).toBeTruthy();
  });

  it('resume la asistencia y permite copiar el enlace de una invitación activa', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await mount();
    const summary = screen.getByLabelText('Resumen de la invitación');
    expect(within(summary).getByText('Confirmados')).toBeTruthy();
    expect(within(summary).getByText('Pendientes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://boda.example/invitacion/CS7H4K2P'));
  });

  it('muestra casos sin mensaje, sin sustituciones, archivado y permiso vigente', async () => {
    await mount({ message: '', replacementsAllowed: false, isArchived: true, archivedAt: '2026-09-21T12:00:00Z', editOverrideUntil: '2099-10-02T12:00:00Z' });
    expect(screen.getByText('Sin mensaje')).toBeTruthy();
    expect(screen.getByText('No permitidas')).toBeTruthy();
    expect(screen.getByText('Archivada')).toBeTruthy();
    expect(screen.getByText('Permiso sin efecto mientras está archivada')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Restaurar invitación' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Conceder permiso' })).toBeNull();
  });

  it('conserva la restricción para una sola persona', async () => {
    const one = [{ name: 'Cassandra', shortName: 'Cassandra', type: 'known' as const, attending: null }];
    vi.mocked(getInvitationById).mockResolvedValue({ ...base, maxGuests: 1, guests: one });
    render(<MemoryRouter initialEntries={['/invitaciones/CS7H4K2P']}><Routes><Route path="/invitaciones/:id" element={<InvitationDetailPage />} /></Routes></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Personas (1)' });
    expect(screen.getByText('1 lugar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Acciones para Cassandra' }));
    expect((screen.getByRole('button', { name: 'Eliminar invitado' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('No se puede eliminar el último invitado.')).toBeTruthy();
  });

  it('edita solo el nombre o solo las sustituciones y permite ajustar lugares', async () => {
    await mount();
    vi.mocked(updateInvitation).mockResolvedValue({ ...base, displayName: 'Nuevo nombre' });
    const data = screen.getByRole('region', { name: 'Datos de la invitación' });
    fireEvent.click(within(data).getByRole('button', { name: 'Editar nombre' }));
    expect(screen.queryByLabelText('Permitir sustituciones')).toBeNull();
    fireEvent.change(screen.getByLabelText('Nombre de la invitación'), { target: { value: 'Nuevo nombre' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(updateInvitation).toHaveBeenCalledWith(base.id, { displayName: 'Nuevo nombre' }));
    fireEvent.click(within(data).getByRole('button', { name: 'Cambiar' }));
    expect(screen.queryByLabelText('Nombre de la invitación')).toBeNull();
    vi.mocked(updateInvitation).mockResolvedValue({ ...base, replacementsAllowed: false });
    fireEvent.click(screen.getByLabelText('Permitir sustituciones'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(updateInvitation).toHaveBeenCalledWith(base.id, { replacementsAllowed: false }));
    vi.mocked(changeInvitationCapacity).mockResolvedValue({ ...base, maxGuests: 3 });
    fireEvent.click(screen.getByRole('button', { name: 'Ajustar lugares' }));
    fireEvent.change(screen.getByLabelText('Nueva cantidad de lugares'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar lugares' }));
    await waitFor(() => expect(changeInvitationCapacity).toHaveBeenCalledWith(base.id, { maxGuests: 3 }));
  });

  it('mantiene editar y eliminar en el menú de cada persona', async () => {
    await mount();
    vi.mocked(updateInvitationGuestName).mockResolvedValue({ ...base, guests: [{ ...base.guests[0], name: 'Cassandra Nueva' }, base.guests[1]] });
    fireEvent.click(screen.getByRole('button', { name: 'Acciones para Cassandra Us Hernandez' }));
    fireEvent.click(within(screen.getByRole('region', { name: 'Personas (2)' })).getByRole('button', { name: 'Editar nombre' }));
    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Cassandra Nueva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(updateInvitationGuestName).toHaveBeenCalledWith(base.id, 0, base.version, 'Cassandra Nueva'));
    vi.mocked(removeInvitationGuest).mockResolvedValue({ ...base, maxGuests: 1, guests: [base.guests[0]] });
    fireEvent.click(screen.getByRole('button', { name: 'Acciones para Acompañante' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar invitado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar invitado' }));
    await waitFor(() => expect(removeInvitationGuest).toHaveBeenCalledWith(base.id, 1, base.version));
  });

  it('conserva la restauración de una sustitución y las acciones de permiso', async () => {
    await mount({ guests: [base.guests[0], { name: 'María Nueva', shortName: 'María', type: 'replacement', attending: true, originalName: 'María Original' }] });
    fireEvent.click(screen.getByRole('button', { name: 'Acciones para María Nueva' }));
    expect(screen.getByRole('button', { name: 'Restaurar invitado original' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Eliminar invitado' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Restaurar invitado original' }));
    expect(screen.getByRole('button', { name: 'Restaurar invitado' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Conceder permiso' }));
    expect(screen.getByLabelText('Fecha y hora de Cancún')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Archivar invitación' })).toBeTruthy();
  });
});
