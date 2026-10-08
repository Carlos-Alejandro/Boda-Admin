// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { notify } from '../../../shared/notifications/notify';
import { ApiOutcomeUnknownError, ApiResponseError } from '../../../services/http/apiClient';
import { createInvitation } from '../api/invitationService';
import type { Invitation } from '../model/invitation.types';
import { CreateInvitationPage } from './CreateInvitationPage';
import { invitation } from '../../../../tests/dashboardTestSupport';

vi.hoisted(() => { vi.stubEnv('VITE_API_BASE_URL', 'https://api.test'); });
vi.mock('../../../config/firebase', () => ({ auth: { currentUser: null } }));

if (typeof HTMLDialogElement !== 'undefined') {
	if (!HTMLDialogElement.prototype.showModal) {
		HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
	}
	if (!HTMLDialogElement.prototype.close) {
		HTMLDialogElement.prototype.close = function close() {
			this.open = false;
			this.dispatchEvent(new Event('close'));
		};
	}
}

vi.mock('../api/invitationService', () => ({ createInvitation: vi.fn() }));
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

const mount = () => render(<MemoryRouter><CreateInvitationPage /></MemoryRouter>);

function CurrentPath() {
	return <p data-testid="current-path">{useLocation().pathname}</p>;
}

const mountWithDetailRoute = () => render(
	<MemoryRouter initialEntries={['/invitaciones/nueva']}>
		<Routes>
			<Route path="/invitaciones/nueva" element={<CreateInvitationPage />} />
			<Route path="/invitaciones/:id" element={<CurrentPath />} />
		</Routes>
	</MemoryRouter>,
);

describe('feedback al crear una invitación', () => {
	beforeEach(() => vi.clearAllMocks());
	afterEach(() => {
		cleanup();
		vi.unstubAllEnvs();
	});

	it('mantiene las validaciones de campos inline y no las convierte en toast', () => {
		mount();
		expect(screen.queryByText('Gestión de invitaciones')).toBeNull();
		expect(screen.getByRole('heading', { level: 1, name: 'Nueva invitación' })).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Crear invitación' }));

		expect(screen.getByText('Ingresa el nombre de la invitación.')).toBeTruthy();
		expect(screen.getByText('Agrega al menos un invitado o un espacio abierto.')).toBeTruthy();
		expect(createInvitation).not.toHaveBeenCalled();
		expect(notify.error).not.toHaveBeenCalled();
	});

	it('usa feedback global para un fallo de la operación', async () => {
		vi.mocked(createInvitation).mockRejectedValue(new Error('network'));
		mount();
		fireEvent.change(screen.getByPlaceholderText('Ej. Familia Ruiz'), { target: { value: 'Familia Ruiz' } });
		fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1' } });
		fireEvent.click(screen.getByRole('button', { name: 'Crear invitación' }));

		await waitFor(() => expect(notify.error).toHaveBeenCalledWith('No se pudo crear la invitación', {
			description: 'Revisa los datos e inténtalo nuevamente.',
		}));
		expect(screen.queryByText('No fue posible crear la invitación.')).toBeNull();
	});

	it.each([new ApiResponseError(201, true), new ApiOutcomeUnknownError()])('bloquea reintentos cuando la creación pudo completarse', async error => {
		vi.mocked(createInvitation).mockRejectedValue(error);
		mount();
		fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la invitación' }), { target: { value: 'Familia Ruiz' } });
		fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '1' } });
		fireEvent.click(screen.getByRole('button', { name: 'Crear invitación' }));
		const alert = await screen.findByRole('alert');
		expect(alert.textContent).toContain('podría haberse creado');
		expect(screen.getByRole('link', { name: 'Ir al listado' }).getAttribute('href')).toBe('/invitaciones');
		expect(screen.getByRole('button', { name: 'Crear invitación' }).hasAttribute('disabled')).toBe(true);
		fireEvent.submit(screen.getByRole('button', { name: 'Crear invitación' }).closest('form')!);
		expect(createInvitation).toHaveBeenCalledTimes(1);
	});

	it('actualiza el resumen al editar personas, lugares y sustituciones', () => {
		mount();
		const summary = screen.getByRole('complementary', { name: 'Resumen de invitación' });
		const counts = () => [...summary.querySelectorAll('dd')].map((cell) => cell.textContent);
		expect(counts()).toEqual(['0', '0', '0']);
		fireEvent.click(screen.getByRole('button', { name: '+ Agregar persona' }));
		fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la persona 1' }), { target: { value: 'Ana Ruiz' } });
		fireEvent.change(screen.getByRole('spinbutton', { name: 'Lugares adicionales' }), { target: { value: '2' } });
		expect(counts()).toEqual(['1', '2', '3']);
		fireEvent.click(screen.getByRole('checkbox', { name: 'Permitir sustituciones' }));
		expect(within(summary).getByText('Sustituciones permitidas')).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));
		expect(counts()).toEqual(['0', '2', '2']);
		expect(screen.getByRole('link', { name: 'Cancelar' }).getAttribute('href')).toBe('/invitaciones');
	});

	it('conserva validaciones de personas y lugares editados', () => {
		mount();
		fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la invitación' }), { target: { value: 'Familia Ruiz' } });
		fireEvent.click(screen.getByRole('button', { name: '+ Agregar persona' }));
		fireEvent.change(screen.getByRole('spinbutton', { name: 'Lugares adicionales' }), { target: { value: '-1' } });
		fireEvent.click(screen.getByRole('button', { name: 'Crear invitación' }));
		expect(screen.getByText('Completa o quita los invitados que no tengan nombre.')).toBeTruthy();
		expect(screen.getByText('Los espacios abiertos deben ser un número entero mayor o igual a cero.')).toBeTruthy();
		expect(createInvitation).not.toHaveBeenCalled();
	});

	it('muestra un diálogo modal con el nombre y el ID reales sin toast duplicado', async () => {
		let resolve!: (value: Invitation) => void;
		vi.mocked(createInvitation).mockReturnValue(new Promise((done) => { resolve = done; }));
		mount();
		fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la invitación' }), { target: { value: ' Familia Ruiz ' } });
		fireEvent.click(screen.getByRole('button', { name: '+ Agregar persona' }));
		fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la persona 1' }), { target: { value: ' Ana Ruiz ' } });
		fireEvent.change(screen.getByRole('spinbutton', { name: 'Lugares adicionales' }), { target: { value: '2' } });
		fireEvent.click(screen.getByRole('checkbox', { name: 'Permitir sustituciones' }));
		fireEvent.click(screen.getByRole('button', { name: 'Crear invitación' }));
		expect(createInvitation).toHaveBeenCalledWith({ displayName: 'Familia Ruiz', knownGuests: [{ name: 'Ana Ruiz' }], openSlots: 2, replacementsAllowed: true });
		expect(screen.getByRole('button', { name: 'Creando...' }).hasAttribute('disabled')).toBe(true);
		expect(screen.getByRole('checkbox', { name: 'Permitir sustituciones' }).hasAttribute('disabled')).toBe(true);
		fireEvent.submit(screen.getByRole('button', { name: 'Creando...' }).closest('form')!);
		expect(createInvitation).toHaveBeenCalledTimes(1);
		await act(async () => resolve(invitation('ABC12345', { displayName: 'Familia Ruiz' })));
		expect(createInvitation).toHaveBeenCalledTimes(1);
		const dialog = screen.getByRole('dialog', { name: 'Invitación creada' });
		expect(dialog.getAttribute('aria-modal')).toBe('true');
		expect(screen.getByText('Familia Ruiz se creó correctamente.')).toBeTruthy();
		expect(screen.getByText('ABC12345')).toBeTruthy();
		expect(screen.getByRole('link', { name: 'Ver invitación' }).getAttribute('href')).toBe('/invitaciones/ABC12345');
		expect(screen.getByRole('heading', { level: 1, name: 'Nueva invitación' })).toBeTruthy();
		expect(screen.getByRole('textbox', { name: 'Nombre de la invitación' })).toBeTruthy();
		expect(notify.success).not.toHaveBeenCalled();
		expect(notify.error).not.toHaveBeenCalled();
	});

	it('navega al detalle usando el ID real creado', async () => {
		vi.mocked(createInvitation).mockResolvedValue(invitation('ABC12345', { displayName: 'Familia Ruiz' }));
		mountWithDetailRoute();
		fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la invitación' }), { target: { value: 'Familia Ruiz' } });
		fireEvent.change(screen.getByRole('spinbutton', { name: 'Lugares adicionales' }), { target: { value: '1' } });
		fireEvent.click(screen.getByRole('button', { name: 'Crear invitación' }));

		await screen.findByRole('dialog', { name: 'Invitación creada' });
		fireEvent.click(screen.getByRole('link', { name: 'Ver invitación' }));
		expect((await screen.findByTestId('current-path')).textContent).toBe('/invitaciones/ABC12345');
	});

	it('copia el enlace público de la invitación creada y confirma el éxito', async () => {
		vi.stubEnv('VITE_PUBLIC_INVITATION_BASE_URL', 'https://wedding.test/');
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
		vi.mocked(createInvitation).mockResolvedValue(invitation('ABC12345', { displayName: 'Familia Ruiz' }));
		mount();
		fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la invitación' }), { target: { value: 'Familia Ruiz' } });
		fireEvent.change(screen.getByRole('spinbutton', { name: 'Lugares adicionales' }), { target: { value: '1' } });
		fireEvent.click(screen.getByRole('button', { name: 'Crear invitación' }));
		await screen.findByRole('dialog', { name: 'Invitación creada' });

		fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }));

		await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://wedding.test/invitacion/ABC12345'));
		expect(notify.success).toHaveBeenCalledWith('Enlace copiado', {
			description: 'Puedes compartir la invitación de Familia Ruiz.',
		});
		expect(screen.getByRole('dialog', { name: 'Invitación creada' })).toBeTruthy();
	});

	it('informa si falla la copia sin cerrar el modal', async () => {
		vi.stubEnv('VITE_PUBLIC_INVITATION_BASE_URL', 'https://wedding.test');
		const writeText = vi.fn().mockRejectedValue(new Error('clipboard blocked'));
		Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
		vi.mocked(createInvitation).mockResolvedValue(invitation('ABC12345', { displayName: 'Familia Ruiz' }));
		mount();
		fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la invitación' }), { target: { value: 'Familia Ruiz' } });
		fireEvent.change(screen.getByRole('spinbutton', { name: 'Lugares adicionales' }), { target: { value: '1' } });
		fireEvent.click(screen.getByRole('button', { name: 'Crear invitación' }));
		await screen.findByRole('dialog', { name: 'Invitación creada' });

		fireEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }));

		await waitFor(() => expect(notify.error).toHaveBeenCalledWith('No se pudo copiar el enlace', {
			description: 'Inténtalo nuevamente.',
		}));
		expect(screen.getByRole('dialog', { name: 'Invitación creada' })).toBeTruthy();
		expect(notify.success).not.toHaveBeenCalled();
	});

	it('crear otra cierra el diálogo y prepara el formulario sin recargar', async () => {
		vi.mocked(createInvitation).mockResolvedValue(invitation('ABC12345', { displayName: 'Familia Ruiz' }));
		mount();
		fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la invitación' }), { target: { value: 'Familia Ruiz' } });
		fireEvent.change(screen.getByRole('spinbutton', { name: 'Lugares adicionales' }), { target: { value: '2' } });
		fireEvent.click(screen.getByRole('button', { name: 'Crear invitación' }));

		await screen.findByRole('dialog', { name: 'Invitación creada' });
		fireEvent.click(screen.getByRole('button', { name: 'Crear otra invitación' }));
		expect(screen.queryByRole('dialog')).toBeNull();
		expect((screen.getByRole('textbox', { name: 'Nombre de la invitación' }) as HTMLInputElement).value).toBe('');
		expect((screen.getByRole('spinbutton', { name: 'Lugares adicionales' }) as HTMLInputElement).value).toBe('0');
		fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la invitación' }), { target: { value: 'Familia Pérez' } });
		fireEvent.change(screen.getByRole('spinbutton', { name: 'Lugares adicionales' }), { target: { value: '1' } });
		fireEvent.click(screen.getByRole('button', { name: 'Crear invitación' }));
		await waitFor(() => expect(createInvitation).toHaveBeenCalledTimes(2));
	});

	it('cerrar deja Nueva invitación en blanco y permite cerrar con Escape', async () => {
		vi.mocked(createInvitation).mockResolvedValue(invitation('ABC12345', { displayName: 'Familia Ruiz' }));
		mount();
		fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la invitación' }), { target: { value: 'Familia Ruiz' } });
		fireEvent.change(screen.getByRole('spinbutton', { name: 'Lugares adicionales' }), { target: { value: '1' } });
		fireEvent.click(screen.getByRole('button', { name: 'Crear invitación' }));

		const dialog = await screen.findByRole('dialog', { name: 'Invitación creada' });
		fireEvent.keyDown(dialog, { key: 'Escape' });
		expect(screen.queryByRole('dialog')).toBeNull();
		expect((screen.getByRole('textbox', { name: 'Nombre de la invitación' }) as HTMLInputElement).value).toBe('');
		expect(screen.getByRole('heading', { level: 1, name: 'Nueva invitación' })).toBeTruthy();

		fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la invitación' }), { target: { value: 'Familia Ruiz' } });
		fireEvent.change(screen.getByRole('spinbutton', { name: 'Lugares adicionales' }), { target: { value: '1' } });
		fireEvent.click(screen.getByRole('button', { name: 'Crear invitación' }));
		const reopenedDialog = await screen.findByRole('dialog', { name: 'Invitación creada' });
		fireEvent.click(within(reopenedDialog).getByRole('button', { name: 'Cerrar' }));
		expect(screen.queryByRole('dialog')).toBeNull();
		expect((screen.getByRole('textbox', { name: 'Nombre de la invitación' }) as HTMLInputElement).value).toBe('');
	});
});
