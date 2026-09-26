// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { notify } from '../../../shared/notifications/notify';
import { archiveInvitation, getInvitations, restoreInvitation } from '../api/invitationService';
import type { Guest, Invitation } from '../model/invitation.types';
import { InvitationListPage } from './InvitationListPage';

vi.hoisted(() => { vi.stubEnv('VITE_PUBLIC_INVITATION_BASE_URL', 'https://public.test'); });
vi.mock('../api/invitationService', () => ({
	getInvitations: vi.fn(),
	archiveInvitation: vi.fn(),
	restoreInvitation: vi.fn(),
}));
vi.mock('../../../shared/notifications/notify', () => ({
	notify: {
		success: vi.fn(),
		error: vi.fn(),
		warning: vi.fn(),
		info: vi.fn(),
		loading: vi.fn(),
		dismiss: vi.fn(),
	},
}));

const guest = (name: string, attending: boolean | null, type: Guest['type'] = 'known', originalName?: string): Guest => ({
	name,
	shortName: name.split(/\s+/)[0] || 'Acompañante',
	type,
	attending,
	...(originalName ? { originalName } : {}),
});

const invitation = (id: string, overrides: Partial<Invitation> = {}): Invitation => ({
	id,
	version: `version-${id}`,
	displayName: `Familia ${id}`,
	maxGuests: 1,
	replacementsAllowed: true,
	rsvpStatus: 'pending',
	message: '',
	isArchived: false,
	archivedAt: null,
	updatedAt: null,
	editOverrideUntil: null,
	guests: [guest(`Persona ${id}`, null)],
	...overrides,
});

const detailed = invitation('REAL-1', {
	displayName: 'Familia Rivera',
	maxGuests: 5,
	rsvpStatus: 'partial',
	updatedAt: '2026-09-20T15:00:00.000Z',
	guests: [
		guest('Ana Rivera', true),
		guest('', null, 'open'),
		guest('Luis Rivera', false),
		guest('Paula Rivera', null),
		guest('María Nueva', true, 'replacement', 'María Original'),
	],
});
const archived = invitation('ARCH-2', { isArchived: true, rsvpStatus: 'declined' });

function mount(items: Invitation[] = [detailed, archived]) {
	vi.mocked(getInvitations).mockResolvedValue({ items, total: items.length });
	return render(<MemoryRouter><InvitationListPage /></MemoryRouter>);
}

function renderPage() {
	return render(<MemoryRouter><InvitationListPage /></MemoryRouter>);
}

async function ready() {
	return screen.findByRole('table', { name: 'Listado de invitaciones' });
}

describe('listado de invitaciones', () => {
	const writeText = vi.fn<(_: string) => Promise<void>>();

	it('explica y resalta coincidencias por nombre de invitado, también con acentos', async () => {
		mount();
		await ready();
		expect(screen.queryByText(/Coincidencia/)).toBeNull();

		fireEvent.change(screen.getByLabelText('Buscar invitaciones'), { target: { value: 'MARIA' } });
		await waitFor(() => expect(screen.getByLabelText('Coincidencia: María Nueva')).toBeTruthy(), { timeout: 1200 });
		const match = screen.getByLabelText('Coincidencia: María Nueva');
		expect(match.querySelector('mark')?.textContent).toBe('María');
		expect(screen.getByText('Coincidencia:').closest('small')).toBe(match);

		fireEvent.change(screen.getByLabelText('Buscar invitaciones'), { target: { value: 'Familia Rivera' } });
		await waitFor(() => expect(screen.queryByText(/Coincidencia/)).toBeNull(), { timeout: 1200 });
	});

	beforeEach(() => {
		vi.clearAllMocks();
		writeText.mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
	});

	afterEach(() => {
		cleanup();
		vi.useRealTimers();
	});

	it('muestra encabezado, columnas y datos reales sin contar slots anónimos ni originalName', async () => {
		mount();
		const table = await ready();
		expect(screen.getByText(/Nuestra boda/i)).toBeTruthy();
		expect(screen.getByRole('heading', { level: 1, name: 'Invitaciones' })).toBeTruthy();
		expect(screen.getByText('Administra, busca y gestiona las invitaciones de tu boda.')).toBeTruthy();
		expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
			'Familia / Nombre', 'Código', 'Invitados', 'Asistencia', 'Estado', 'Enlace', 'Acciones',
		]);
		const row = within(table).getByRole('row', { name: /Familia Rivera/ });
		expect(within(row).getByText('REAL-1')).toBeTruthy();
		expect(within(row).getByText('4 / 5')).toBeTruthy();
		expect(within(row).getByText('identificados')).toBeTruthy();
		const attendance = row.querySelector('[data-label="Asistencia"]');
		expect(attendance?.textContent).toContain('2 asisten');
		expect(attendance?.textContent).toContain('1 no asiste');
		expect(within(row).getByText('Parcial')).toBeTruthy();
		expect(within(row).queryByText('María Original')).toBeNull();
		expect(screen.getByText('Declinada')).toBeTruthy();
		expect(screen.queryByText('Activa')).toBeNull();
		expect(screen.getByText('Archivada')).toBeTruthy();
		expect(screen.queryByText('Cada invitación guarda un momento')).toBeNull();
	});

	it('usa un popover contextual accesible sin insertarlo en el flujo de la tabla', async () => {
		mount();
		const table = await ready();
		const filterButton = screen.getByRole('button', { name: /Filtros/ });
		const panel = document.getElementById('invitation-list-filters');
		expect(panel?.parentElement?.classList.contains('invitation-filter-control')).toBe(true);
		expect(table.parentElement?.previousElementSibling).toBe(screen.getByLabelText('Herramientas de invitaciones'));
		expect(filterButton.getAttribute('aria-expanded')).toBe('false');
		expect(filterButton.textContent?.trim()).toBe('Filtros');
		expect(filterButton.textContent).not.toMatch(/[\^v⌄]/);
		fireEvent.click(filterButton);
		expect(filterButton.getAttribute('aria-expanded')).toBe('true');
		expect(screen.getByRole('dialog', { name: 'Filtrar invitaciones' })).toBeTruthy();
		expect((screen.getByRole('button', { name: 'Limpiar' }) as HTMLButtonElement).disabled).toBe(true);
		expect((screen.getByRole('button', { name: 'Aplicar filtros' }) as HTMLButtonElement).disabled).toBe(true);
		expect((screen.getByLabelText('Estado RSVP') as HTMLSelectElement).disabled).toBe(false);
		expect((screen.getByLabelText('Estado de invitación') as HTMLSelectElement).disabled).toBe(false);

		fireEvent.click(filterButton);
		expect(filterButton.getAttribute('aria-expanded')).toBe('false');
		fireEvent.click(filterButton);
		fireEvent.mouseDown(document.body);
		expect(filterButton.getAttribute('aria-expanded')).toBe('false');
		fireEvent.click(filterButton);
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(filterButton.getAttribute('aria-expanded')).toBe('false');
		expect(document.activeElement).toBe(filterButton);
	});

	it('mantiene los cambios como draft hasta Aplicar y reabre con los valores aplicados', async () => {
		mount();
		await ready();
		fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
		const applyButton = screen.getByRole('button', { name: 'Aplicar filtros' }) as HTMLButtonElement;
		expect(applyButton.disabled).toBe(true);
		expect(getInvitations).toHaveBeenCalledTimes(1);

		fireEvent.change(screen.getByLabelText('Estado RSVP'), { target: { value: 'confirmed' } });
		fireEvent.change(screen.getByLabelText('Estado de invitación'), { target: { value: 'false' } });
		expect(getInvitations).toHaveBeenCalledTimes(1);
		expect(applyButton.disabled).toBe(false);

		fireEvent.click(applyButton);
		expect(screen.getByRole('button', { name: /Filtros/ }).getAttribute('aria-expanded')).toBe('false');
		expect(screen.queryByRole('dialog', { name: 'Filtrar invitaciones' })).toBeNull();
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith({ archived: false, rsvpStatus: 'confirmed', search: undefined, page: 1, pageSize: 15 }));

		fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
		expect((screen.getByLabelText('Estado RSVP') as HTMLSelectElement).value).toBe('confirmed');
		expect((screen.getByLabelText('Estado de invitación') as HTMLSelectElement).value).toBe('false');
		expect((screen.getByRole('button', { name: 'Aplicar filtros' }) as HTMLButtonElement).disabled).toBe(true);
		expect((screen.getByRole('button', { name: 'Limpiar' }) as HTMLButtonElement).disabled).toBe(false);
	});

	it('muestra el contador solo para filtros aplicados y no cuenta búsqueda ni drafts', async () => {
		mount();
		await ready();
		const filterButton = screen.getByRole('button', { name: 'Filtros' });
		expect(filterButton.querySelector('.invitation-toolbar__filter-count')).toBeNull();

		fireEvent.change(screen.getByLabelText('Buscar invitaciones'), { target: { value: 'Rivera' } });
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith({ archived: undefined, rsvpStatus: undefined, search: 'Rivera', page: 1, pageSize: 15 }), { timeout: 1200 });
		expect(filterButton.querySelector('.invitation-toolbar__filter-count')).toBeNull();

		fireEvent.click(filterButton);
		fireEvent.change(screen.getByLabelText('Estado RSVP'), { target: { value: 'confirmed' } });
		expect(filterButton.querySelector('.invitation-toolbar__filter-count')).toBeNull();
		fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith({ archived: undefined, rsvpStatus: 'confirmed', search: 'Rivera', page: 1, pageSize: 15 }));
		expect(screen.getByRole('button', { name: 'Filtros, 1 filtro activo' }).querySelector('.invitation-toolbar__filter-count')?.textContent).toBe('1');

		fireEvent.click(screen.getByRole('button', { name: 'Filtros, 1 filtro activo' }));
		fireEvent.change(screen.getByLabelText('Estado de invitación'), { target: { value: 'false' } });
		expect(screen.getByRole('button', { name: 'Filtros, 1 filtro activo' }).querySelector('.invitation-toolbar__filter-count')?.textContent).toBe('1');
		fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith({ archived: false, rsvpStatus: 'confirmed', search: 'Rivera', page: 1, pageSize: 15 }));
		expect(screen.getByRole('button', { name: 'Filtros, 2 filtros activos' }).querySelector('.invitation-toolbar__filter-count')?.textContent).toBe('2');

		fireEvent.click(screen.getByRole('button', { name: 'Filtros, 2 filtros activos' }));
		fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith({ archived: undefined, rsvpStatus: undefined, search: 'Rivera', page: 1, pageSize: 15 }));
		expect(screen.getByRole('button', { name: 'Filtros' }).querySelector('.invitation-toolbar__filter-count')).toBeNull();
	});

	it('descarta drafts con Escape o click fuera y conserva los filtros aplicados al reabrir', async () => {
		mount();
		await ready();
		const filterButton = screen.getByRole('button', { name: /Filtros/ });
		fireEvent.click(filterButton);
		fireEvent.change(screen.getByLabelText('Estado RSVP'), { target: { value: 'confirmed' } });
		fireEvent.change(screen.getByLabelText('Estado de invitación'), { target: { value: 'false' } });
		fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith({ archived: false, rsvpStatus: 'confirmed', search: undefined, page: 1, pageSize: 15 }));
		const callsAfterApply = vi.mocked(getInvitations).mock.calls.length;

		fireEvent.click(filterButton);
		fireEvent.change(screen.getByLabelText('Estado RSVP'), { target: { value: 'declined' } });
		fireEvent.change(screen.getByLabelText('Estado de invitación'), { target: { value: 'true' } });
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(document.activeElement).toBe(filterButton);
		fireEvent.click(filterButton);
		expect((screen.getByLabelText('Estado RSVP') as HTMLSelectElement).value).toBe('confirmed');
		expect((screen.getByLabelText('Estado de invitación') as HTMLSelectElement).value).toBe('false');

		fireEvent.change(screen.getByLabelText('Estado RSVP'), { target: { value: 'partial' } });
		fireEvent.mouseDown(document.body);
		fireEvent.click(filterButton);
		expect((screen.getByLabelText('Estado RSVP') as HTMLSelectElement).value).toBe('confirmed');
		expect((screen.getByLabelText('Estado de invitación') as HTMLSelectElement).value).toBe('false');
		expect(getInvitations).toHaveBeenCalledTimes(callsAfterApply);
	});

	it('Limpiar elimina ambos filtros aplicados, resetea el draft y cierra el popover', async () => {
		mount();
		await ready();
		const filterButton = screen.getByRole('button', { name: /Filtros/ });
		fireEvent.click(filterButton);
		fireEvent.change(screen.getByLabelText('Estado RSVP'), { target: { value: 'partial' } });
		fireEvent.change(screen.getByLabelText('Estado de invitación'), { target: { value: 'true' } });
		fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith({ archived: true, rsvpStatus: 'partial', search: undefined, page: 1, pageSize: 15 }));

		fireEvent.click(filterButton);
		const clearButton = screen.getByRole('button', { name: 'Limpiar' }) as HTMLButtonElement;
		expect(clearButton.disabled).toBe(false);
		fireEvent.click(clearButton);
		expect(filterButton.getAttribute('aria-expanded')).toBe('false');
		expect(screen.queryByRole('dialog', { name: 'Filtrar invitaciones' })).toBeNull();
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith({ archived: undefined, rsvpStatus: undefined, search: undefined, page: 1, pageSize: 15 }));

		fireEvent.click(filterButton);
		expect((screen.getByLabelText('Estado RSVP') as HTMLSelectElement).value).toBe('');
		expect((screen.getByLabelText('Estado de invitación') as HTMLSelectElement).value).toBe('');
		expect((screen.getByRole('button', { name: 'Limpiar' }) as HTMLButtonElement).disabled).toBe(true);
		expect((screen.getByRole('button', { name: 'Aplicar filtros' }) as HTMLButtonElement).disabled).toBe(true);
	});

	it('mantiene intacto el buscador y su placeholder', async () => {
		mount();
		await ready();
		const search = screen.getByLabelText('Buscar invitaciones') as HTMLInputElement;
		expect(search.placeholder).toBe('Buscar por familia, invitado o código...');
		fireEvent.change(screen.getByLabelText('Buscar invitaciones'), { target: { value: '  Rivera  ' } });
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith({ archived: undefined, rsvpStatus: undefined, search: 'Rivera', page: 1, pageSize: 15 }), { timeout: 1200 });
	});

	it('muestra un empty state filtrado y permite limpiar filtros sin borrar la búsqueda', async () => {
		vi.mocked(getInvitations).mockImplementation(async (filters = {}) => {
			const constrained = Boolean(filters.search || filters.rsvpStatus || filters.archived !== undefined);
			return constrained ? { items: [], total: 0 } : { items: [detailed], total: 1 };
		});
		renderPage();
		await ready();

		const search = screen.getByLabelText('Buscar invitaciones') as HTMLInputElement;
		fireEvent.change(search, { target: { value: 'Rivera' } });
		expect(await screen.findByRole('heading', { name: 'No encontramos invitaciones' })).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Limpiar búsqueda' })).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
		fireEvent.change(screen.getByLabelText('Estado RSVP'), { target: { value: 'confirmed' } });
		fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith({ archived: undefined, rsvpStatus: 'confirmed', search: 'Rivera', page: 1, pageSize: 15 }));
		fireEvent.click(await screen.findByRole('button', { name: 'Limpiar filtros' }));
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith({ archived: undefined, rsvpStatus: undefined, search: 'Rivera', page: 1, pageSize: 15 }));
		expect(search.value).toBe('Rivera');
		expect(screen.getByRole('heading', { name: 'No encontramos invitaciones' })).toBeTruthy();
	});

	it('muestra acciones reales cuando la colección está completamente vacía', async () => {
		mount([]);
		const heading = await screen.findByRole('heading', { name: 'Aún no hay invitaciones' });
		const empty = heading.closest('section') as HTMLElement;
		expect(within(empty).getByText('Crea tu primera invitación o impórtalas desde Excel.')).toBeTruthy();
		expect(within(empty).getByRole('link', { name: 'Nueva invitación' }).getAttribute('href')).toBe('/invitaciones/nueva');
		expect(within(empty).getByRole('link', { name: 'Importar Excel' }).getAttribute('href')).toBe('/invitaciones/importar');
		expect(screen.queryByRole('table')).toBeNull();
	});

	it('usa un skeleton semántico sin exponer filas o contenido ficticio', () => {
		vi.mocked(getInvitations).mockReturnValue(new Promise(() => undefined));
		renderPage();
		const loading = screen.getByRole('status', { name: 'Cargando invitaciones' });
		expect(loading.querySelector('.invitation-skeleton__visual')?.getAttribute('aria-hidden')).toBe('true');
		expect(screen.queryByRole('table')).toBeNull();
		expect(screen.queryByRole('row')).toBeNull();
	});

	it('renderiza los cuatro estados RSVP sin redefinirlos', async () => {
		mount([
			invitation('PENDING', { rsvpStatus: 'pending' }),
			invitation('CONFIRMED', { rsvpStatus: 'confirmed' }),
			invitation('PARTIAL', { rsvpStatus: 'partial' }),
			invitation('DECLINED', { rsvpStatus: 'declined' }),
		]);
		await ready();
		for (const label of ['Pendiente', 'Confirmada', 'Parcial', 'Declinada']) {
			expect(screen.getByText(label)).toBeTruthy();
		}
	});

	it('copia una URL distinta por id, no navega y notifica éxito o error', async () => {
		mount();
		await ready();
		const first = screen.getByRole('button', { name: 'Copiar enlace de Familia Rivera' });
		const tooltip = screen.getAllByRole('tooltip')[0];
		expect(tooltip.textContent).toBe('Copiar enlace');
		expect(first.getAttribute('aria-describedby')).toBe(tooltip.id);
		fireEvent.click(first);
		await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://public.test/invitacion/REAL-1'));
		expect(notify.success).toHaveBeenCalledWith('Enlace copiado', {
			description: 'Puedes compartir la invitación de Familia Rivera.',
		});
		expect(window.location.pathname).toBe('/');

		fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace de Familia ARCH-2' }));
		await waitFor(() => expect(writeText).toHaveBeenLastCalledWith('https://public.test/invitacion/ARCH-2'));
		expect(new Set(writeText.mock.calls.map(([url]) => url)).size).toBe(2);

		writeText.mockRejectedValueOnce(new Error('clipboard blocked'));
		fireEvent.click(first);
		await waitFor(() => expect(notify.error).toHaveBeenCalledWith('No se pudo copiar el enlace', {
			description: 'Inténtalo nuevamente.',
		}));
	});

	it('mantiene los avatares deterministas entre invitaciones del mismo estado', async () => {
		mount([invitation('UNO'), invitation('DOS')]);
		const table = await ready();
		const avatars = table.querySelectorAll('.invitation-table__avatar');
		expect(avatars).toHaveLength(2);
		expect(avatars[0].className).toBe(avatars[1].className);
		expect(avatars[0].className).toContain('invitation-table__avatar--pending');
	});

	it('abre un solo menú, enlaza detalle/edición y cierra con Escape o click fuera', async () => {
		mount();
		await ready();
		expect(screen.getAllByRole('link', { name: /Ver detalle/ })[0].getAttribute('href')).toBe('/invitaciones/REAL-1');
		const activeMenu = screen.getByRole('button', { name: 'Más acciones para Familia Rivera' });
		fireEvent.keyDown(activeMenu, { key: 'ArrowDown' });
		expect(activeMenu.getAttribute('aria-expanded')).toBe('true');
		expect(screen.getByRole('menu')).toBeTruthy();
		expect(screen.getByRole('menuitem', { name: 'Editar invitación' }).getAttribute('href')).toBe('/invitaciones/REAL-1');
		expect(screen.getByRole('menuitem', { name: 'Archivar' })).toBeTruthy();

		fireEvent.keyDown(document, { key: 'Escape' });
		expect(screen.queryByRole('menu')).toBeNull();
		fireEvent.click(activeMenu);
		fireEvent.mouseDown(document.body);
		expect(screen.queryByRole('menu')).toBeNull();

		fireEvent.click(screen.getByRole('button', { name: 'Más acciones para Familia ARCH-2' }));
		expect(screen.getByRole('menuitem', { name: 'Restaurar' })).toBeTruthy();
		expect(screen.queryByRole('menuitem', { name: 'Archivar' })).toBeNull();
	});

	it('archivar requiere confirmación, evita ejecución accidental y restaura con la operación real', async () => {
		vi.mocked(archiveInvitation).mockResolvedValue({ ...detailed, isArchived: true, archivedAt: '2026-09-25T12:00:00.000Z' });
		vi.mocked(restoreInvitation).mockResolvedValue({ ...archived, isArchived: false, archivedAt: null });
		mount();
		await ready();

		fireEvent.click(screen.getByRole('button', { name: 'Más acciones para Familia Rivera' }));
		expect(archiveInvitation).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole('menuitem', { name: 'Archivar' }));
		expect(archiveInvitation).not.toHaveBeenCalled();
		expect(screen.getByRole('dialog', { name: 'Archivar invitación' })).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Confirmar archivo' }));
		await waitFor(() => expect(archiveInvitation).toHaveBeenCalledOnce());
		expect(notify.success).toHaveBeenCalledWith('Invitación archivada', {
			description: 'La invitación dejó de estar disponible para el invitado.',
		});

		await ready();
		await waitFor(() => expect(screen.getByRole('button', { name: 'Más acciones para Familia ARCH-2' })).toBeTruthy());
		fireEvent.click(screen.getByRole('button', { name: 'Más acciones para Familia ARCH-2' }));
		fireEvent.click(screen.getByRole('menuitem', { name: 'Restaurar' }));
		expect(restoreInvitation).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', { name: 'Confirmar restauración' }));
		await waitFor(() => expect(restoreInvitation).toHaveBeenCalledOnce());
		expect(notify.success).toHaveBeenCalledWith('Invitación restaurada', {
			description: 'La invitación volvió a estar activa.',
		});
	});

	it('notifica los fallos reales de archivo y restauración sin omitir confirmación', async () => {
		vi.mocked(archiveInvitation).mockRejectedValueOnce(new Error('network'));
		vi.mocked(restoreInvitation).mockRejectedValueOnce(new Error('network'));
		mount();
		await ready();

		fireEvent.click(screen.getByRole('button', { name: 'Más acciones para Familia Rivera' }));
		fireEvent.click(screen.getByRole('menuitem', { name: 'Archivar' }));
		expect(archiveInvitation).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', { name: 'Confirmar archivo' }));
		await waitFor(() => expect(notify.error).toHaveBeenCalledWith('No se pudo archivar la invitación', {
			description: 'Revisa el estado de la invitación e inténtalo nuevamente.',
		}));

		await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Archivar invitación' })).toBeNull());
		fireEvent.click(screen.getByRole('button', { name: 'Más acciones para Familia ARCH-2' }));
		fireEvent.click(screen.getByRole('menuitem', { name: 'Restaurar' }));
		expect(restoreInvitation).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', { name: 'Confirmar restauración' }));
		await waitFor(() => expect(notify.error).toHaveBeenCalledWith('No se pudo restaurar la invitación', {
			description: 'Revisa el estado de la invitación e inténtalo nuevamente.',
		}));
	});

	it('pagina 15/16 resultados con resumen, estados disabled y aria-current', async () => {
		const firstPage = Array.from({ length: 15 }, (_, index) => invitation(`P1-${index + 1}`));
		const last = invitation('P2-16');
		vi.mocked(getInvitations).mockImplementation(async (filters = {}) => filters.page === 2
			? { items: [last], total: 16, page: 2, pageSize: 15, totalPages: 2 }
			: { items: firstPage, total: 16, page: 1, pageSize: 15, totalPages: 2 });
		renderPage();
		await ready();
		expect(screen.getByText('Mostrando 1–15 de 16 invitaciones')).toBeTruthy();
		expect((screen.getByRole('button', { name: 'Anterior' }) as HTMLButtonElement).disabled).toBe(true);
		expect(screen.getByRole('button', { name: 'Ir a la página 1' }).getAttribute('aria-current')).toBe('page');

		fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
		expect(await screen.findByText('Familia P2-16')).toBeTruthy();
		expect(screen.getByText('Mostrando 16–16 de 16 invitaciones')).toBeTruthy();
		expect((screen.getByRole('button', { name: 'Siguiente' }) as HTMLButtonElement).disabled).toBe(true);
		expect(screen.getByRole('button', { name: 'Ir a la página 2' }).getAttribute('aria-current')).toBe('page');
	});

	it('vuelve a página 1 al buscar o aplicar filtros', async () => {
		vi.mocked(getInvitations).mockResolvedValue({ items: [detailed], total: 30, page: 1, pageSize: 15, totalPages: 2 });
		renderPage();
		await ready();
		fireEvent.click(screen.getByRole('button', { name: 'Ir a la página 2' }));
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
		fireEvent.change(screen.getByLabelText('Buscar invitaciones'), { target: { value: 'Carlos' } });
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, search: 'Carlos' })), { timeout: 1200 });

		fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
		fireEvent.change(screen.getByLabelText('Estado RSVP'), { target: { value: 'confirmed' } });
		fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, rsvpStatus: 'confirmed' })));
	});

	it('acepta la página corregida por API después de archivar el único resultado final', async () => {
		let archivedCurrent = false;
		const only = invitation('ONLY-P2');
		vi.mocked(getInvitations).mockImplementation(async (filters = {}) => {
			if (filters.page === 2 && !archivedCurrent) return { items: [only], total: 16, page: 2, pageSize: 15, totalPages: 2 };
			if (!archivedCurrent) return { items: [detailed], total: 16, page: 1, pageSize: 15, totalPages: 2 };
			return { items: [detailed], total: 15, page: 1, pageSize: 15, totalPages: 1 };
		});
		vi.mocked(archiveInvitation).mockImplementation(async () => {
			archivedCurrent = true;
			return { ...only, isArchived: true, archivedAt: '2026-09-25T12:00:00.000Z' };
		});
		renderPage();
		await ready();
		fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
		expect(await screen.findByText('Familia ONLY-P2')).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Más acciones para Familia ONLY-P2' }));
		fireEvent.click(screen.getByRole('menuitem', { name: 'Archivar' }));
		fireEvent.click(screen.getByRole('button', { name: 'Confirmar archivo' }));
		expect(await screen.findByText('Mostrando 1–15 de 15 invitaciones')).toBeTruthy();
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));
	});
});
