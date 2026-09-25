// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { notify } from '../../../shared/notifications/notify';
import { createInvitation } from '../api/invitationService';
import { CreateInvitationPage } from './CreateInvitationPage';

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
});
