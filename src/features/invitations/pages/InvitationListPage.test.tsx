// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { notify } from '../../../shared/notifications/notify';
import { archiveInvitation, getInvitations, restoreInvitation } from '../api/invitationService';
import type { Guest, Invitation, InvitationFilters, InvitationListResponse } from '../model/invitation.types';
import { InvitationListPage } from './InvitationListPage';

vi.hoisted(() => {
	vi.stubEnv('VITE_PUBLIC_INVITATION_BASE_URL', 'https://public.test');
	vi.stubEnv('VITE_API_BASE_URL', 'https://api.test');
});
vi.mock('../../../config/firebase', () => ({ auth: { currentUser: null } }));
vi.mock('../api/invitationService', () => ({ getInvitations: vi.fn(), archiveInvitation: vi.fn(), restoreInvitation: vi.fn() }));
vi.mock('../../../shared/notifications/notify', () => ({ notify: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), loading: vi.fn(), dismiss: vi.fn() } }));

const guest = (name: string, attending: boolean | null, type: Guest['type'] = 'known'): Guest => ({ name, shortName: name.split(/\s+/)[0] || 'Acompañante', type, attending });
const invitation = (id: string, overrides: Partial<Invitation> = {}): Invitation => ({
	id, version: `version-${id}`, displayName: `Familia ${id}`, maxGuests: 1, replacementsAllowed: true,
	rsvpStatus: 'pending', message: '', isArchived: false, archivedAt: null, updatedAt: null, editOverrideUntil: null,
	guests: [guest(`Persona ${id}`, null)], ...overrides,
});
const active = invitation('ACT-1', { displayName: 'Familia Rivera', maxGuests: 2, updatedAt: '2026-10-06T12:00:00.000Z', guests: [guest('Ana Rivera', true), guest('', null, 'open')] });
const archived = invitation('ARCH-2', { displayName: 'Familia Archivo', isArchived: true, archivedAt: '2026-10-08T12:00:00.000Z', updatedAt: '2025-01-01T12:00:00.000Z', rsvpStatus: 'declined' });
const writeText = vi.fn<(_: string) => Promise<void>>();

function CurrentPath() {
	return <p data-testid="current-path">{useLocation().pathname}</p>;
}

function mount({ items = [active], archivedView = false, activeView = false, total = items.length, load }: { items?: Invitation[]; archivedView?: boolean; activeView?: boolean; total?: number; load?: (filters?: InvitationFilters) => Promise<InvitationListResponse> } = {}) {
	vi.mocked(getInvitations).mockImplementation(load ?? (async () => ({ items, total, page: 1, pageSize: 15, totalPages: Math.ceil(total / 15) })));
	return render(
		<MemoryRouter initialEntries={[archivedView ? '/invitaciones/archivadas' : activeView ? '/invitaciones?estado=activas' : '/invitaciones']}>
			<Routes>
				<Route path="/invitaciones" element={<InvitationListPage />} />
				<Route path="/invitaciones/archivadas" element={<InvitationListPage archivedView />} />
				<Route path="/invitaciones/:id" element={<CurrentPath />} />
			</Routes>
		</MemoryRouter>,
	);
}

async function ready(name = 'Listado de invitaciones') {
	return screen.findByRole('table', { name });
}

beforeEach(() => {
	vi.clearAllMocks();
	writeText.mockResolvedValue(undefined);
	Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});
afterEach(cleanup);

describe('listado de invitaciones', () => {
	it('Todas carga invitaciones activas y archivadas sin enviar el parámetro archived', async () => {
		const table = await (async () => { mount({ items: [active, archived] }); return ready(); })();
		expect(await screen.findByRole('heading', { name: 'Invitaciones' })).toBeTruthy();
		expect(getInvitations).toHaveBeenLastCalledWith({ search: undefined, rsvpStatus: undefined, archived: undefined, page: 1, pageSize: 15 });
		expect(within(table).getAllByRole('row')).toHaveLength(3);
		expect(within(table).getByRole('link', { name: 'Familia Rivera' })).toBeTruthy();
		expect(within(table).getByRole('link', { name: 'Familia Archivo' })).toBeTruthy();
		expect(within(table).getByRole('row', { name: /Familia Archivo/ }).className).toContain('invitation-table__archived');
		expect(within(table).getByText('Archivada')).toBeTruthy();
		expect(within(table).getByRole('button', { name: 'Copiar enlace de Familia Archivo' })).toBeTruthy();
		expect(within(table).getByRole('button', { name: 'Restaurar invitación: Familia Archivo' })).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Importar Excel' })).toBeTruthy();
	});

	it('la ruta Archivadas solicita solo registros archivados y muestra archivedAt sin sustituirlo por updatedAt', async () => {
		mount({ items: [archived], archivedView: true });
		const table = await ready('Listado de invitaciones archivadas');
		expect(screen.getByRole('heading', { name: 'Invitaciones archivadas' })).toBeTruthy();
		expect(getInvitations).toHaveBeenLastCalledWith({ search: undefined, rsvpStatus: undefined, archived: true, page: 1, pageSize: 15 });
		expect(within(table).getByRole('columnheader', { name: 'Fecha de archivo' })).toBeTruthy();
		expect(within(table).getByText('8 oct 2026')).toBeTruthy();
		expect(within(table).queryByText('1 ene 2025')).toBeNull();
		expect(within(table).getByRole('row', { name: /Familia Archivo/ }).className).toContain('invitation-table__archived');
		expect(within(table).getByText('Archivada')).toBeTruthy();
		expect(within(table).getByRole('button', { name: 'Restaurar invitación: Familia Archivo' })).toBeTruthy();
		const copy = within(table).getByRole('button', { name: 'Copiar enlace de Familia Archivo' });
		expect(screen.queryByRole('link', { name: 'Importar Excel' })).toBeNull();
		fireEvent.click(copy);
		await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://public.test/invitacion/ARCH-2'));
		expect(notify.success).toHaveBeenCalledWith('Enlace copiado', expect.any(Object));
		expect(screen.getByRole('heading', { name: 'Invitaciones archivadas' })).toBeTruthy();
		expect(screen.getByRole('table', { name: 'Listado de invitaciones archivadas' })).toBeTruthy();
	});

	it('Estado de invitación sincroniza Todas, Activas y Archivadas con la vista y la consulta', async () => {
		const load = async (filters: InvitationFilters = {}) => ({
			items: filters.archived === true ? [archived] : filters.archived === false ? [active] : [active, archived],
			total: filters.archived === true || filters.archived === false ? 1 : 2,
		});
		mount({ items: [active, archived], load });
		await ready();
		expect(getInvitations).toHaveBeenLastCalledWith({ search: undefined, rsvpStatus: undefined, archived: undefined, page: 1, pageSize: 15 });
		fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
		const rsvp = screen.getByRole('combobox', { name: 'Estado RSVP' });
		expect(Array.from((rsvp as HTMLSelectElement).options, ({ text }) => text)).toEqual([
			'Todos', 'Pendientes', 'Confirmadas', 'Parciales', 'Declinadas',
		]);
		const scope = screen.getByRole('combobox', { name: 'Estado de invitación' });
		expect(Array.from((scope as HTMLSelectElement).options, ({ text }) => text)).toEqual(['Todas', 'Activas', 'Archivadas']);
		fireEvent.change(rsvp, { target: { value: 'confirmed' } });
		fireEvent.change(scope, { target: { value: 'archived' } });
		fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
		const archivedTable = await ready('Listado de invitaciones archivadas');
		expect(getInvitations).toHaveBeenLastCalledWith({ search: undefined, rsvpStatus: 'confirmed', archived: true, page: 1, pageSize: 15 });
		expect(within(archivedTable).queryByText('Familia Rivera')).toBeNull();

		fireEvent.click(screen.getByRole('button', { name: 'Filtros, 2 filtros activos' }));
		const archivedScope = screen.getByRole('combobox', { name: 'Estado de invitación' }) as HTMLSelectElement;
		expect(archivedScope.value).toBe('archived');
		fireEvent.change(archivedScope, { target: { value: 'active' } });
		fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
		const activeTable = await ready();
		expect(getInvitations).toHaveBeenLastCalledWith({ search: undefined, rsvpStatus: 'confirmed', archived: false, page: 1, pageSize: 15 });
		expect(within(activeTable).queryByText('Familia Archivo')).toBeNull();

		fireEvent.click(screen.getByRole('button', { name: 'Filtros, 2 filtros activos' }));
		const activeScope = screen.getByRole('combobox', { name: 'Estado de invitación' }) as HTMLSelectElement;
		expect(activeScope.value).toBe('active');
		fireEvent.change(activeScope, { target: { value: 'all' } });
		fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
		const allAgain = await ready();
		expect(getInvitations).toHaveBeenLastCalledWith({ search: undefined, rsvpStatus: 'confirmed', archived: undefined, page: 1, pageSize: 15 });
		expect(within(allAgain).getByText('Familia Archivo')).toBeTruthy();
	});

	it('muestra fecha no disponible si archivedAt falta, sin usar updatedAt', async () => {
		const item = { ...archived, archivedAt: null };
		const table = await (async () => { mount({ items: [item], archivedView: true }); return ready('Listado de invitaciones archivadas'); })();
		expect(within(table).getByText('Fecha no disponible')).toBeTruthy();
		expect(within(table).queryByText('1 ene 2025')).toBeNull();
	});

	it('conserva el filtro RSVP, búsqueda y página en el servidor', async () => {
		vi.mocked(getInvitations).mockResolvedValue({ items: [active], total: 30, page: 1, pageSize: 15, totalPages: 2 });
		mount({ items: [active], activeView: true, total: 30 });
		await ready();
		fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith(expect.objectContaining({ archived: false, page: 2, pageSize: 15 })));
		fireEvent.change(screen.getByLabelText('Buscar invitaciones'), { target: { value: 'Rivera' } });
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith(expect.objectContaining({ archived: false, page: 1, search: 'Rivera' })), { timeout: 1200 });
		fireEvent.click(screen.getByRole('button', { name: /^Filtros/ }));
		fireEvent.change(screen.getByLabelText('Estado RSVP'), { target: { value: 'confirmed' } });
		fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith(expect.objectContaining({ archived: false, page: 1, search: 'Rivera', rsvpStatus: 'confirmed' })));
		await waitFor(() => expect(screen.getByText(/30 invitaciones/)).toBeTruthy());
	});

	it('pagina las archivadas con filtro fijo y conserva los totales devueltos por la API', async () => {
		const last = invitation('ARCH-16', { isArchived: true, archivedAt: '2026-10-01T12:00:00.000Z' });
		const load = async (filters: InvitationFilters = {}) => filters.page === 2
			? { items: [last], total: 16, page: 2, pageSize: 15, totalPages: 2 }
			: { items: [archived], total: 16, page: 1, pageSize: 15, totalPages: 2 };
		mount({ items: [archived], archivedView: true, total: 16, load });
		await ready('Listado de invitaciones archivadas');
		fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
		expect(await screen.findByRole('link', { name: 'Familia ARCH-16' })).toBeTruthy();
		expect(getInvitations).toHaveBeenLastCalledWith({ search: undefined, rsvpStatus: undefined, archived: true, page: 2, pageSize: 15 });
		expect(document.querySelector('.invitation-list-summary p')?.textContent).toContain('16–16 de 16 invitaciones');
	});

	it('copia el enlace público correcto y muestra el tooltip accesible', async () => {
		const table = await (async () => { mount(); return ready(); })();
		const copy = within(table).getByRole('button', { name: 'Copiar enlace de Familia Rivera' });
		const tooltip = screen.getAllByRole('tooltip')[0];
		expect(copy.getAttribute('aria-describedby')).toBe(tooltip.id);
		fireEvent.click(copy);
		await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://public.test/invitacion/ACT-1'));
		expect(notify.success).toHaveBeenCalledWith('Enlace copiado', { description: 'Puedes compartir la invitación de Familia Rivera.' });
		expect(screen.queryByTestId('current-path')).toBeNull();
	});

	it('hace clic en el área libre para abrir el detalle y mantiene acciones separadas', async () => {
		mount();
		const table = await ready();
		const row = within(table).getByRole('row', { name: /Familia Rivera/ });
		expect(within(row).getByRole('link', { name: 'Familia Rivera' }).tabIndex).toBe(0);
		fireEvent.click(row.querySelector('[headers="invitation-col-code"]')!);
		expect(screen.getByTestId('current-path').textContent).toBe('/invitaciones/ACT-1');
	});

	it('archiva con confirmación y quita el registro de la lista activa', async () => {
		let archivedNow = false;
		const load = async (filters: InvitationFilters = {}) => filters.archived
			? { items: archivedNow ? [{ ...active, isArchived: true, archivedAt: '2026-10-08T12:00:00.000Z' }] : [], total: Number(archivedNow) }
			: { items: archivedNow ? [] : [active], total: Number(!archivedNow) };
		vi.mocked(archiveInvitation).mockImplementation(async () => {
			archivedNow = true;
			return { ...active, isArchived: true, archivedAt: '2026-10-08T12:00:00.000Z' };
		});
		mount({ activeView: true, load });
		const table = await ready();
		fireEvent.click(within(table).getByRole('button', { name: 'Archivar invitación: Familia Rivera' }));
		expect(await screen.findByRole('dialog', { name: 'Archivar invitación' })).toBeTruthy();
		expect(screen.queryByTestId('current-path')).toBeNull();
		fireEvent.click(screen.getByRole('button', { name: 'Confirmar archivo' }));
		await waitFor(() => expect(archiveInvitation).toHaveBeenCalledWith('ACT-1'));
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith({ search: undefined, rsvpStatus: undefined, archived: false, page: 1, pageSize: 15 }));
		await waitFor(() => expect(screen.queryByRole('table')).toBeNull());
		expect(notify.success).toHaveBeenCalledTimes(1);
		expect(vi.mocked(archiveInvitation).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(notify.success).mock.invocationCallOrder[0]);
		expect(notify.success).toHaveBeenCalledWith('Invitación archivada', { description: 'La invitación se archivó correctamente' });
	});

	it('restaura desde Archivadas y elimina el registro de esa lista', async () => {
		let restored = false;
		const load = async (filters: InvitationFilters = {}) => filters.archived
			? { items: restored ? [] : [archived], total: Number(!restored) }
			: { items: restored ? [{ ...archived, isArchived: false, archivedAt: null }] : [], total: Number(restored) };
		vi.mocked(restoreInvitation).mockImplementation(async () => {
			restored = true;
			return { ...archived, isArchived: false, archivedAt: null };
		});
		mount({ items: [archived], archivedView: true, load });
		const table = await ready('Listado de invitaciones archivadas');
		fireEvent.click(within(table).getByRole('button', { name: 'Restaurar invitación: Familia Archivo' }));
		fireEvent.click(await screen.findByRole('button', { name: 'Confirmar restauración' }));
		await waitFor(() => expect(restoreInvitation).toHaveBeenCalledWith('ARCH-2'));
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith({ search: undefined, rsvpStatus: undefined, archived: true, page: 1, pageSize: 15 }));
		await waitFor(() => expect(screen.queryByRole('table')).toBeNull());
		expect(notify.success).toHaveBeenCalledTimes(1);
		expect(vi.mocked(restoreInvitation).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(notify.success).mock.invocationCallOrder[0]);
		expect(notify.success).toHaveBeenCalledWith('Invitación restaurada', { description: 'La invitación se restauró correctamente' });
	});

	it.each([
		{ operation: 'archive' as const, activeView: true, invitation: active, button: 'Archivar invitación: Familia Rivera', confirm: 'Confirmar archivo', service: archiveInvitation, title: 'No se pudo archivar la invitación' },
		{ operation: 'restore' as const, archivedView: true, invitation: archived, button: 'Restaurar invitación: Familia Archivo', confirm: 'Confirmar restauración', service: restoreInvitation, title: 'No se pudo restaurar la invitación' },
	])('notifica el error cuando falla la operación de $operation', async ({ activeView, archivedView, invitation: rowInvitation, button, confirm, service, title }) => {
		vi.mocked(service).mockRejectedValueOnce(new Error('offline'));
		mount({ items: [rowInvitation], activeView, archivedView });
		const table = await ready(archivedView ? 'Listado de invitaciones archivadas' : 'Listado de invitaciones');
		fireEvent.click(within(table).getByRole('button', { name: button }));
		fireEvent.click(await screen.findByRole('button', { name: confirm }));
		await waitFor(() => expect(notify.error).toHaveBeenCalledTimes(1));
		expect(notify.error).toHaveBeenCalledWith(title, { description: 'Revisa el estado de la invitación e inténtalo nuevamente.' });
		expect(notify.success).not.toHaveBeenCalled();
	});

	it('conserva el diálogo de archivo para fallos y cancela con Escape', async () => {
		mount({ activeView: true });
		const table = await ready();
		fireEvent.click(within(table).getByRole('button', { name: 'Archivar invitación: Familia Rivera' }));
		const dialog = await screen.findByRole('dialog', { name: 'Archivar invitación' });
		expect(document.body.style.overflow).toBe('hidden');
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(screen.queryByRole('dialog', { name: 'Archivar invitación' })).toBeNull();
		expect(document.body.style.overflow).toBe('');
		expect(archiveInvitation).not.toHaveBeenCalled();
		expect(dialog).toBeTruthy();
	});

	it('muestra empty states, carga y errores con el patrón existente', async () => {
		mount({ items: [], total: 0 });
		expect(await screen.findByRole('heading', { name: 'Aún no hay invitaciones' })).toBeTruthy();
		cleanup();
		vi.mocked(getInvitations).mockRejectedValueOnce(new Error('offline'));
		mount();
		expect((await screen.findByRole('alert')).textContent).toContain('No fue posible cargar las invitaciones.');
	});
});
