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

async function ready() {
	return screen.findByRole('table', { name: 'Listado de invitaciones' });
}

describe('listado de invitaciones', () => {
	const writeText = vi.fn<(_: string) => Promise<void>>();

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
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith({ archived: false, rsvpStatus: 'confirmed', search: undefined }));

		fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
		expect((screen.getByLabelText('Estado RSVP') as HTMLSelectElement).value).toBe('confirmed');
		expect((screen.getByLabelText('Estado de invitación') as HTMLSelectElement).value).toBe('false');
		expect((screen.getByRole('button', { name: 'Aplicar filtros' }) as HTMLButtonElement).disabled).toBe(true);
		expect((screen.getByRole('button', { name: 'Limpiar' }) as HTMLButtonElement).disabled).toBe(false);
	});

	it('descarta drafts con Escape o click fuera y conserva los filtros aplicados al reabrir', async () => {
		mount();
		await ready();
		const filterButton = screen.getByRole('button', { name: /Filtros/ });
		fireEvent.click(filterButton);
		fireEvent.change(screen.getByLabelText('Estado RSVP'), { target: { value: 'confirmed' } });
		fireEvent.change(screen.getByLabelText('Estado de invitación'), { target: { value: 'false' } });
		fireEvent.click(screen.getByRole('button', { name: 'Aplicar filtros' }));
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith({ archived: false, rsvpStatus: 'confirmed', search: undefined }));
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
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith({ archived: true, rsvpStatus: 'partial', search: undefined }));

		fireEvent.click(filterButton);
		const clearButton = screen.getByRole('button', { name: 'Limpiar' }) as HTMLButtonElement;
		expect(clearButton.disabled).toBe(false);
		fireEvent.click(clearButton);
		expect(filterButton.getAttribute('aria-expanded')).toBe('false');
		expect(screen.queryByRole('dialog', { name: 'Filtrar invitaciones' })).toBeNull();
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith({ archived: undefined, rsvpStatus: undefined, search: undefined }));

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
		await waitFor(() => expect(getInvitations).toHaveBeenLastCalledWith({ archived: undefined, rsvpStatus: undefined, search: 'Rivera' }), { timeout: 1200 });
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
});
