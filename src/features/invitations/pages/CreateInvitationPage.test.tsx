// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { notify } from '../../../shared/notifications/notify';
import { createInvitation } from '../api/invitationService';
import type { Invitation } from '../model/invitation.types';
import { CreateInvitationPage } from './CreateInvitationPage';
import { invitation } from '../../../../tests/dashboardTestSupport';

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

describe('feedback al crear una invitación', () => {
	beforeEach(() => vi.clearAllMocks());
	afterEach(cleanup);

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

	it('envía el mismo payload una sola vez y conserva el estado de carga y éxito', async () => {
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
		expect(screen.getByText('Invitación creada correctamente.')).toBeTruthy();
		expect(notify.success).toHaveBeenCalled();
	});
});
