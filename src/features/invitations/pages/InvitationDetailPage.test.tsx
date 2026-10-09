// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changeInvitationCapacity, getInvitationById, removeInvitationGuest, updateInvitation, updateInvitationGuestName } from '../api/invitationService';
import type { Invitation } from '../model/invitation.types';
import { InvitationDetailPage } from './InvitationDetailPage';

vi.hoisted(() => { vi.stubEnv('VITE_API_BASE_URL', 'https://api.test'); });
vi.mock('../../../config/firebase', () => ({ auth: { currentUser: null } }));
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
  return screen.findByRole('heading', { name: 'Personas' });
}
beforeEach(() => { vi.clearAllMocks(); });
afterEach(cleanup);

describe('detalle de la invitación', () => {
  it('mantiene el orden fijo y coloca los indicadores dentro de Personas', async () => {
    await mount();
    const sections = Array.from(document.querySelectorAll('.invitation-detail__sections > section'), (section) => section.getAttribute('aria-label'));
    expect(sections).toEqual(['Personas', 'Datos de la invitación', 'Administración']);
    const people = screen.getByRole('region', { name: 'Personas' });
    expect(within(people).getByRole('group', { name: 'Resumen de asistencia' })).toBeTruthy();
    expect(people.compareDocumentPosition(screen.getByRole('region', { name: 'Datos de la invitación' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('RESUMEN DE ASISTENCIA')).toBeNull();
    expect(screen.queryByRole('button', { name: /Mover / })).toBeNull();
    expect(document.querySelector('.invitation-detail__drag-grip')).toBeNull();
  });
  it.each([
    ['pending', 'Pendiente'], ['confirmed', 'Confirmada'], ['declined', 'Declinada'], ['partial', 'Parcial'],
  ] as const)('muestra el RSVP %s una sola vez', async (rsvpStatus, label) => {
    await mount({ rsvpStatus });
    expect(screen.getByRole('heading', { name: 'Detalles de la invitación' })).toBeTruthy();
    expect(screen.getAllByText(label)).toHaveLength(1);
    const statusBadge = screen.getByText(label).closest('.invitation-status-badge');
    expect(statusBadge?.classList.contains('invitation-status-badge--prominent')).toBe(true);
    expect(statusBadge?.classList.contains(`invitation-status-badge--${rsvpStatus}`)).toBe(true);
    expect(statusBadge?.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
    expect(screen.queryByRole('button', { name: label })).toBeNull();
    expect(screen.getAllByText('Cassandra & Rubén')).toHaveLength(1);
    expect(screen.getAllByText('CS7H4K2P')).toHaveLength(1);
    expect(within(screen.getByRole('group', { name: 'Resumen de asistencia' })).getByText(/2 lugares en total/)).toBeTruthy();
    expect(screen.getAllByText('Gracias')).toHaveLength(1);
    expect(screen.queryByText('Información general')).toBeNull();
  });

  it('presenta invitados, lugar sin nombre, permisos y estado administrativo', async () => {
    await mount();
    const people = screen.getByRole('region', { name: 'Personas' });
    expect(within(people).getByText('Cassandra Us Hernandez')).toBeTruthy();
    expect(within(people).getByText('Lugar sin asignar')).toBeTruthy();
    expect(within(people).getByText('Asiste')).toBeTruthy();
    expect(within(people).queryByText('No asiste')).toBeNull();
    expect(within(people).queryByText('Sin respuesta')).toBeNull();
    const data = screen.getByRole('region', { name: 'Datos de la invitación' });
    expect(within(data).getByText('Permitidas')).toBeTruthy();
    const admin = screen.getByRole('region', { name: 'Administración' });
    expect(within(admin).getByText('Sin permiso')).toBeTruthy();
    expect(within(admin).getByText('Activa')).toBeTruthy();
    expect(within(admin).getByRole('button', { name: 'Archivar invitación' })).toBeTruthy();
  });

  it('trata el espacio abierto con nombre como acompañante y muestra su RSVP', async () => {
    await mount({ guests: [base.guests[0], { name: 'Carlos Pérez', shortName: 'Acompañante', type: 'open', attending: false }] });
    const people = screen.getByRole('region', { name: 'Personas' });
    expect(within(people).getByText('Carlos Pérez')).toBeTruthy();
    expect(within(people).getByText('Acompañante')).toBeTruthy();
    expect(within(people).getByText('No asiste')).toBeTruthy();
    expect(within(people).queryByText('Lugar sin asignar')).toBeNull();
  });

  it('keeps unassigned open places free when the invitation is declined', async () => {
    await mount({
      rsvpStatus: 'declined',
      maxGuests: 2,
      guests: [
        { name: '', shortName: 'Acompañante', type: 'open', attending: false },
        { name: '', shortName: 'Acompañante', type: 'open', attending: false },
      ],
    });
    const people = screen.getByRole('region', { name: 'Personas' });
    expect(within(people).getAllByText('Lugar sin asignar')).toHaveLength(2);
    expect(within(people).queryByText('No asiste')).toBeNull();
    expect(within(people).getByText('2 lugares libres')).toBeTruthy();
    expect(screen.getByText('Declinada')).toBeTruthy();
  });

  it('muestra asistencia, capacidad y lugares libres dentro de Personas y copia el enlace', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await mount();
    const metrics = screen.getByRole('group', { name: 'Resumen de asistencia' });
    expect(metrics.textContent).toContain('1 asistirá');
    expect(metrics.textContent).toContain('2 lugares en total');
    expect(metrics.textContent).toContain('1 lugar libre');
    expect(Array.from(metrics.querySelectorAll('.invitation-detail__attendance-item'), (item) => item.textContent?.trim())).toEqual([
      '2 lugares en total', '1 asistirá', '1 lugar libre',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://boda.example/invitacion/CS7H4K2P'));
  });

  it('no cuenta un lugar abierto sin nombre como persona que asistirá', async () => {
    await mount({ guests: [{ ...base.guests[0], attending: false }, { ...base.guests[1], attending: true }] });
    const metrics = screen.getByRole('group', { name: 'Resumen de asistencia' });
    expect(metrics.textContent).toContain('0 asistirán');
    expect(metrics.textContent).toContain('1 lugar libre');
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
    await screen.findByRole('heading', { name: 'Personas' });
    expect(screen.getByText(/1 lugar en total/)).toBeTruthy();
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
    fireEvent.click(within(screen.getByRole('region', { name: 'Personas' })).getByRole('button', { name: 'Editar nombre' }));
    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: 'Cassandra Nueva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(updateInvitationGuestName).toHaveBeenCalledWith(base.id, 0, base.version, 'Cassandra Nueva'));
    vi.mocked(removeInvitationGuest).mockResolvedValue({ ...base, maxGuests: 1, guests: [base.guests[0]] });
    fireEvent.click(screen.getByRole('button', { name: 'Acciones para Acompañante' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar invitado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar invitado' }));
    await waitFor(() => expect(removeInvitationGuest).toHaveBeenCalledWith(base.id, 1, base.version));
  });

  it('coloca el menú de personas sobre la fila cuando falta espacio debajo', async () => {
    await mount();
    const trigger = screen.getByRole('button', { name: 'Acciones para Cassandra Us Hernandez' });
    const anchor = trigger.parentElement as HTMLDivElement;
    anchor.getBoundingClientRect = () => ({ top: 650, bottom: 700 } as DOMRect);
    fireEvent.click(trigger);
    const panel = document.getElementById('invitation-detail-menu-0') as HTMLDivElement;
    Object.defineProperty(panel, 'scrollHeight', { configurable: true, value: 240 });
    fireEvent(window, new Event('resize'));
    expect(panel.classList.contains('invitation-detail__menu--above')).toBe(true);
    expect(panel.style.maxHeight).toBe('630px');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(document.activeElement).toBe(trigger);
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
