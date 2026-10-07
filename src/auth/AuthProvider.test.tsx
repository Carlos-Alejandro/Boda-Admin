// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AuthListener = (user: User | null) => void;
const authMocks = vi.hoisted(() => ({
	auth: {},
	onAuthStateChanged: vi.fn(),
	signOut: vi.fn(),
	listener: null as AuthListener | null,
	finishSignOut: null as (() => void) | null,
}));

vi.mock('../config/firebase', () => ({ auth: authMocks.auth }));
vi.mock('firebase/auth', () => ({
	GoogleAuthProvider: class GoogleAuthProvider {},
	onAuthStateChanged: authMocks.onAuthStateChanged,
	signInWithPopup: vi.fn(),
	signOut: authMocks.signOut,
}));

import { auth } from '../config/firebase';
import { AdminSidebar } from '../shared/components/AdminSidebar/AdminSidebar';
import { AuthProvider } from './AuthProvider';
import { ProtectedRoute } from '../routes/ProtectedRoute';

const accountUser = { displayName: 'María Pérez', email: 'maria@example.com' } as User;
let mobile = false;

function mount(path = '/invitaciones') {
	return render(
		<AuthProvider>
			<MemoryRouter initialEntries={[path]}>
				<Routes>
					<Route path="/login" element={<p>Pantalla de acceso</p>} />
					<Route element={<ProtectedRoute />}>
						<Route path="/invitaciones" element={<><AdminSidebar /><p>Contenido protegido</p></>} />
					</Route>
				</Routes>
			</MemoryRouter>
		</AuthProvider>,
	);
}

describe('AuthProvider y rutas protegidas', () => {
	beforeEach(() => {
		mobile = false;
		authMocks.listener = null;
		authMocks.finishSignOut = null;
		authMocks.onAuthStateChanged.mockReset().mockImplementation((_auth: unknown, listener: AuthListener) => {
			authMocks.listener = listener;
			return vi.fn();
		});
		authMocks.signOut.mockReset().mockImplementation(() => new Promise<void>((resolve) => {
			authMocks.finishSignOut = resolve;
		}));
		vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
			get matches() { return mobile; },
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		})));
	});
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
	});

	it('llama a Firebase signOut, oculta el contenido durante el cierre y termina en login', async () => {
		mount();
		expect(screen.getByRole('status').textContent).toContain('Restaurando sesión');
		expect(screen.queryByText('Contenido protegido')).toBeNull();
		await act(async () => { authMocks.listener?.(accountUser); });
		expect(screen.getByText('Contenido protegido')).toBeTruthy();

		fireEvent.click(screen.getByRole('button', { name: 'Cuenta de María Pérez' }));
		fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
		expect(authMocks.signOut).toHaveBeenCalledWith(auth);
		expect(screen.getByRole('status').textContent).toContain('Cerrando sesión');
		expect(screen.queryByText('Contenido protegido')).toBeNull();

		await act(async () => {
			authMocks.listener?.(null);
			authMocks.finishSignOut?.();
		});
		expect(screen.getByText('Pantalla de acceso')).toBeTruthy();
		expect(screen.queryByText('Contenido protegido')).toBeNull();
	});

	it('redirige una ruta protegida al login si Firebase restaura una sesión vacía', async () => {
		mount('/invitaciones');
		expect(screen.queryByText('Contenido protegido')).toBeNull();
		await act(async () => { authMocks.listener?.(null); });
		expect(screen.getByText('Pantalla de acceso')).toBeTruthy();
		expect(screen.queryByText('Contenido protegido')).toBeNull();
	});
});
