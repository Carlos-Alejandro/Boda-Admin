// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';
import { getInvitations } from '../../invitations/api/invitationService';
import type { InvitationListResponse } from '../../invitations/model/invitation.types';
import { guest, invitation } from '../../../../tests/dashboardTestSupport';

vi.mock('../../invitations/api/invitationService', () => ({ getInvitations: vi.fn() }));
const mount = () => render(<StrictMode><MemoryRouter><DashboardPage /></MemoryRouter></StrictMode>);
const ready = () => screen.findByRole('group', { name: 'Resumen en cuatro tarjetas' });

describe('Dashboard funcional', () => {
 beforeEach(() => vi.mocked(getInvitations).mockReset());
 afterEach(cleanup);
 it('carga sin ceros ficticios y reutiliza la solicitud en StrictMode', async () => {
  let resolve!: (value: InvitationListResponse) => void;
  vi.mocked(getInvitations).mockReturnValue(new Promise(done => { resolve = done; }));
  mount();
  expect(screen.getByRole('status').textContent).toContain('Cargando');
  const decoration = document.querySelector('.dashboard-hero__decoration');
  expect(decoration).toBeTruthy();
  expect(decoration?.querySelector('.dashboard-hero__branch')).toBeTruthy();
  expect(screen.queryByRole('group', { name: 'Resumen en cuatro tarjetas' })).toBeNull();
  expect(getInvitations).toHaveBeenCalledTimes(1);
  expect(getInvitations).toHaveBeenCalledWith();
  await act(async () => resolve({ items: [], total: 0 }));
  expect(screen.queryByText('Cargando resumen de la boda...')).toBeNull();
 });
 it('error y reintento recuperan datos sin conservar resultados ficticios', async () => {
  vi.mocked(getInvitations).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ items: [invitation('A')], total: 1 });
  mount();
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByRole('group')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await ready();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(getInvitations).toHaveBeenCalledTimes(2);
 });
 it.each([0, 20])('rechaza total=%s incoherente y retry vuelve a consultar', async total => {
  vi.mocked(getInvitations).mockResolvedValueOnce({ items: [invitation('A')], total }).mockResolvedValueOnce({ items: [invitation('A')], total: 1 });
  mount();
  await screen.findByRole('alert');
  expect(screen.queryByRole('group')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  await ready();
  expect(getInvitations).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole('alert')).toBeNull();
 });
 it('nombres completos, enlaces de cada panel y semántica accesible del resumen', async () => {
  const name = 'Nombre completo muy largo '.repeat(10).trim();
  const items = [invitation('ABC12345', { displayName: name, guests: [guest(name, null, 'replacement')], updatedAt: '2026-09-22T15:00:00Z' })];
  vi.mocked(getInvitations).mockResolvedValue({ items, total: 1 });
  mount(); await ready();
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  const regions = ['Cupos por invitación', 'Personas sin respuesta', 'Invitaciones actualizadas recientemente'];
  for (const region of regions) {
   const panel = screen.getByRole('region', { name: region });
   expect(within(panel).getByRole('link', { name }).getAttribute('href')).toBe('/invitaciones/ABC12345');
  }
  expect(screen.getByRole('progressbar', { name: 'Respuesta RSVP de personas identificadas' }).getAttribute('value')).toBe('0');
  expect(screen.getByRole('progressbar').getAttribute('max')).toBe('1');
  expect(screen.getByRole('region', { name: 'Estado RSVP' }).querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  for (const link of screen.getAllByRole('link')) {
   expect(link.textContent?.trim()).not.toBe('');
   expect(['/invitaciones', '/invitaciones/nueva', '/invitaciones/importar', '/invitaciones/ABC12345']).toContain(link.getAttribute('href'));
  }
 });
 it('capacidad cero inesperada no produce una división inválida en las barras', async () => {
  // Defensive rendering only: Boda-API rejects maxGuests < 1.
  vi.mocked(getInvitations).mockResolvedValue({ items: [invitation('ZERO', { maxGuests: 0, guests: [] })], total: 1 });
  mount(); await ready();
  const panel = screen.getByRole('region', { name: 'Cupos por invitación' });
  const bar = panel.querySelector('[aria-hidden="true"] > span') as HTMLElement;
  expect(bar.style.width).toBe('0%');
  expect(panel.innerHTML).not.toMatch(/NaN|Infinity/);
  expect(screen.queryByRole('progressbar')).toBeNull();
 });
 it('fechas inválidas y archivadas no producen actualizaciones visibles', async () => {
  const items = [invitation('INVALID', { updatedAt: 'fecha inválida' }), invitation('NULL'), invitation('ARCH', { isArchived: true, updatedAt: '2026-09-22T15:00:00Z' })];
  vi.mocked(getInvitations).mockResolvedValue({ items, total: items.length });
  mount(); await ready();
  const recent = screen.getByRole('region', { name: 'Invitaciones actualizadas recientemente' });
  expect(within(recent).queryAllByRole('link')).toHaveLength(0);
  expect(recent.querySelector('time')).toBeNull();
 });
 it('estado vacío con acciones reales, anillo vacío y denominador cero', async () => {
  vi.mocked(getInvitations).mockResolvedValue({ items: [], total: 0 });
  mount(); await ready();
  expect(screen.getByText(/Todavía no hay invitaciones/)).toBeTruthy();
  expect(screen.getByText('Sin personas identificadas')).toBeTruthy();
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.getAllByRole('link', { name: /Nueva invitación/ }).every(link => link.getAttribute('href') === '/invitaciones/nueva')).toBe(true);
  expect(screen.getAllByRole('link', { name: /Importar Excel/ }).every(link => link.getAttribute('href') === '/invitaciones/importar')).toBe(true);
  expect(screen.getByText('No hay fechas de actualización disponibles para invitaciones activas.')).toBeTruthy();
 });
 it('cuatro tarjetas, distribución textual, selecciones, seguimiento y enlaces reales', async () => {
  const items = [invitation('A/B', { displayName: 'Familia visible', maxGuests: 4, guests: [guest('Asistente', true), guest('Pendiente real'), guest('No asistente', false), guest('', false, 'open')], rsvpStatus: 'partial', updatedAt: '2026-09-22T15:00:00Z' }), invitation('ARCH', { isArchived: true, guests: [guest('Nombre archivado')] })];
  vi.mocked(getInvitations).mockResolvedValue({ items, total: 2 });
  mount(); const cards = await ready();
  expect(within(cards).getAllByRole('heading', { level: 2 })).toHaveLength(4);
  expect(document.getElementById(cards.getAttribute('aria-describedby')!)?.textContent).toBe('Personas, cupos y RSVP: solo invitaciones activas.');
  expect(within(cards).getByText('1 no asisten')).toBeTruthy();
  expect(within(cards).getByText('1 sin respuesta')).toBeTruthy();
  expect(within(cards).getByText('66.7%')).toBeTruthy();
  expect(within(cards).getByText('2 de 3 personas identificadas han respondido')).toBeTruthy();
  expect(within(cards).getByRole('progressbar').getAttribute('value')).toBe('2');
  expect(within(cards).getByRole('progressbar').getAttribute('max')).toBe('3');
  const distribution = screen.getByRole('region', { name: 'Estado RSVP' });
  for (const label of ['Confirmadas', 'Parciales', 'Pendientes', 'Declinadas']) expect(within(distribution).getByText(label)).toBeTruthy();
  expect(within(distribution).getByText('Parciales').parentElement?.querySelector('dd')?.textContent).toBe('1');
  expect(within(distribution).getByText('Confirmadas').parentElement?.querySelector('dd')?.textContent).toBe('0');
  expect(within(distribution).getByText('invitaciones activas')).toBeTruthy();
  expect(within(distribution).getByText('Un estado parcial no implica una respuesta incompleta.')).toBeTruthy();
  const capacity = screen.getByRole('region', { name: 'Cupos por invitación' });
  expect(within(capacity).getByText(/1 invitación con mayor capacidad/)).toBeTruthy();
  expect(within(capacity).getByRole('link', { name: 'Ver todas' }).getAttribute('href')).toBe('/invitaciones');
  const unanswered = screen.getByRole('region', { name: 'Personas sin respuesta' });
  expect(within(unanswered).getByText('1 de 1 personas pendientes')).toBeTruthy();
  expect(within(unanswered).getByText('Pendiente real')).toBeTruthy();
  expect(within(unanswered).queryByText('No asistente')).toBeNull();
  expect(within(unanswered).getByRole('link', { name: 'Familia visible' }).getAttribute('href')).toBe('/invitaciones/A%2FB');
  const recent = screen.getByRole('region', { name: 'Invitaciones actualizadas recientemente' });
  expect(within(recent).getByText(/Incluye cambios administrativos y RSVP/)).toBeTruthy();
  expect(recent.querySelector('time')?.getAttribute('datetime')).toBe(items[0].updatedAt);
  expect(within(recent).getByText('Parcial')).toBeTruthy();
  const quick = screen.getByRole('region', { name: 'Acciones rápidas' });
  expect(within(quick).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(['/invitaciones/nueva', '/invitaciones/importar', '/invitaciones']);
  expect(screen.getByRole('region', { name: 'Necesitan seguimiento' }).textContent).toContain('Invitaciones con personas sin respuesta1');
  expect(screen.queryByText('Nombre archivado')).toBeNull();
  expect(document.body.textContent).not.toMatch(/abrió|se creó|se importó|confirmó|declinó|Configuración|Ctrl\+K|Confirmaciones recientes|Actividad reciente/);
  expect(screen.queryByRole('searchbox')).toBeNull();
 });
 it('solo archivadas y fechas ausentes no inventan contenido', async () => {
  vi.mocked(getInvitations).mockResolvedValue({ items: [invitation('A', { isArchived: true })], total: 1 });
  mount(); await ready();
  expect(screen.getByText(/Todas las invitaciones están archivadas/)).toBeTruthy();
  expect(screen.getByText('No hay personas identificadas sin respuesta.')).toBeTruthy();
  expect(screen.getByText('Sin personas identificadas')).toBeTruthy();
 });
 it('limita las listas visibles, conserva los totales y no trata partial como tarea', async () => {
  const items = Array.from({ length: 8 }, (_, n) => invitation(String(n), { rsvpStatus: 'partial', updatedAt: `2026-09-${10 + n}T10:00:00Z`, guests: [guest(`Respondida ${n}`, true)] }));
  vi.mocked(getInvitations).mockResolvedValue({ items, total: items.length });
  mount(); await ready();
  const capacity = screen.getByRole('region', { name: 'Cupos por invitación' });
  const recent = screen.getByRole('region', { name: 'Invitaciones actualizadas recientemente' });
  expect(within(capacity).getAllByRole('listitem')).toHaveLength(5);
  expect(within(recent).getAllByRole('listitem')).toHaveLength(5);
  expect(within(recent).getAllByRole('link')[0].textContent).toBe('Familia 7');
  expect(within(capacity).getByText(/5 invitaciones con mayor capacidad/)).toBeTruthy();
  expect(screen.getByText('8 de 8 personas identificadas han respondido')).toBeTruthy();
  expect(screen.getByText('No hay personas identificadas pendientes de respuesta.')).toBeTruthy();
 });
 it('ignora respuestas de un montaje anterior', async () => {
  let resolve!: (value: InvitationListResponse) => void;
  vi.mocked(getInvitations).mockReturnValueOnce(new Promise(done => { resolve = done; })).mockResolvedValueOnce({ items: [], total: 0 });
  const old = mount(); old.unmount(); mount(); await ready();
  await act(async () => resolve({ items: [invitation('Anterior')], total: 1 }));
  expect(screen.queryByText('Familia Anterior')).toBeNull();
 });
});
