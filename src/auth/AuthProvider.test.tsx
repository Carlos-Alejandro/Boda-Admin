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
	getAdminHealth: vi.fn(),
	listener: null as AuthListener | null,
}));

vi.mock('../config/firebase', () => ({ auth: authMocks.auth }));
vi.mock('../features/dashboard/api/dashboardService', () => ({
	getAdminHealth: authMocks.getAdminHealth,
}));
vi.mock('firebase/auth', () => ({
	GoogleAuthProvider: class GoogleAuthProvider {},
	onAuthStateChanged: authMocks.onAuthStateChanged,
	signInWithPopup: vi.fn(),
	signOut: authMocks.signOut,
}));

import { AdminSidebar } from '../shared/components/AdminSidebar/AdminSidebar';
import { notifyAdminAuthenticationFailed, notifyAdminAuthorizationDenied } from './authorizationEvents';
import { AuthProvider } from './AuthProvider';
import { ProtectedRoute } from '../routes/ProtectedRoute';

const accountUser = { uid: 'auth-user', displayName: 'María Pérez', email: 'maria@example.com' } as User;

function mount(path = '/invitaciones') {
	return render(
		<AuthProvider>
			<MemoryRouter initialEntries={[path]}>
				<Routes>
					<Route path="/login" element={<p>Pantalla de acceso</p>} />
					<Route element={<ProtectedRoute />}>
						<Route path="/" element={<><AdminSidebar /><p>Dashboard protegido</p></>} />
						<Route path="/invitaciones" element={<><AdminSidebar /><p>Contenido administrativo protegido</p></>} />
						<Route path="/invitaciones/:id" element={<p>Detalle administrativo protegido</p>} />
					</Route>
				</Routes>
			</MemoryRouter>
		</AuthProvider>,
	);
}

async function restoreUser() {
	await act(async () => {
		authMocks.listener?.(accountUser);
		await Promise.resolve();
	});
}

describe('AuthProvider y rutas administrativas', () => {
	beforeEach(() => {
		authMocks.listener = null;
		authMocks.onAuthStateChanged.mockReset().mockImplementation((_auth: unknown, listener: AuthListener) => {
			authMocks.listener = listener;
			return vi.fn();
		});
		authMocks.signOut.mockReset().mockResolvedValue(undefined);
		authMocks.getAdminHealth.mockReset().mockResolvedValue({ status: 'ok', service: 'boda-api', authenticated: true });
	});
	afterEach(() => cleanup());

	it('waits for backend authorization before rendering a directly opened admin route', async () => {
		let resolveHealth!: (value: unknown) => void;
		authMocks.getAdminHealth.mockImplementation(() => new Promise((resolve) => { resolveHealth = resolve; }));
		mount('/invitaciones/abc123');
		await restoreUser();
		expect(screen.getByRole('status').textContent).toContain('Comprobando autorización');
		expect(screen.queryByText(/Detalle administrativo protegido/)).toBeNull();
		await act(async () => { resolveHealth({ authenticated: true }); });
		expect(screen.getByText('Detalle administrativo protegido')).toBeTruthy();
		expect(authMocks.getAdminHealth).toHaveBeenCalledOnce();
	});

	it('renders protected content for a UID authorized by the backend', async () => {
		mount('/invitaciones');
		await restoreUser();
		expect(screen.getByText('Contenido administrativo protegido')).toBeTruthy();
	});

	it('fails closed when health does not confirm administrative authorization', async () => {
		authMocks.getAdminHealth.mockResolvedValueOnce({ status: 'ok', service: 'boda-api', authenticated: false });
		mount('/invitaciones');
		await restoreUser();
		expect(screen.getByRole('heading', { name: 'No pudimos comprobar el acceso' })).toBeTruthy();
		expect(screen.queryByText('Contenido administrativo protegido')).toBeNull();
	});

	it('shows the unauthorized screen and no admin content when the backend returns 403', async () => {
		authMocks.getAdminHealth.mockImplementation(async () => {
			notifyAdminAuthorizationDenied(accountUser.uid);
			throw new Error('forbidden');
		});
		mount('/invitaciones');
		await restoreUser();
		expect(screen.getByRole('heading', { name: 'Acceso no autorizado' })).toBeTruthy();
		expect(screen.queryByText('Contenido administrativo protegido')).toBeNull();
		expect(screen.queryByRole('navigation')).toBeNull();
		expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
	});

	it('redirects a direct route to login when Firebase has no session', async () => {
		mount('/invitaciones/abc123');
		await act(async () => { authMocks.listener?.(null); });
		expect(screen.getByText('Pantalla de acceso')).toBeTruthy();
		expect(authMocks.getAdminHealth).not.toHaveBeenCalled();
	});

	it('keeps admin content hidden and offers retry when verification has a connection error', async () => {
		authMocks.getAdminHealth.mockRejectedValueOnce(new TypeError('Failed to fetch'));
		mount('/');
		await restoreUser();
		expect(screen.getByRole('heading', { name: 'No pudimos comprobar el acceso' })).toBeTruthy();
		expect(screen.queryByText('Dashboard protegido')).toBeNull();
		authMocks.getAdminHealth.mockResolvedValueOnce({ authenticated: true });
		await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reintentar' })); await Promise.resolve(); });
		expect(screen.getByText('Dashboard protegido')).toBeTruthy();
	});

	it('signs out when an administrative request reports an invalid or expired token', async () => {
		mount('/invitaciones');
		await restoreUser();
		await act(async () => { notifyAdminAuthenticationFailed(accountUser.uid); await Promise.resolve(); });
		expect(authMocks.signOut).toHaveBeenCalledWith(authMocks.auth);
		expect(screen.queryByText('Contenido administrativo protegido')).toBeNull();
	});

	it('keeps a late successful authorization response from undoing a 403 revocation', async () => {
		let resolveHealth!: (value: unknown) => void;
		authMocks.getAdminHealth.mockImplementation(() => new Promise((resolve) => { resolveHealth = resolve; }));
		mount('/invitaciones');
		await restoreUser();
		await act(async () => { notifyAdminAuthorizationDenied(accountUser.uid); });
		expect(screen.getByRole('heading', { name: 'Acceso no autorizado' })).toBeTruthy();
		await act(async () => { resolveHealth({ authenticated: true }); });
		expect(screen.getByRole('heading', { name: 'Acceso no autorizado' })).toBeTruthy();
		expect(screen.queryByText('Contenido administrativo protegido')).toBeNull();
	});

	it('ignores a late 403 from a different Firebase session', async () => {
		mount('/invitaciones');
		await restoreUser();
		await act(async () => { notifyAdminAuthorizationDenied('previous-session'); });
		expect(screen.getByText('Contenido administrativo protegido')).toBeTruthy();
	});

	it('lets an unauthorized user close the Firebase session', async () => {
		authMocks.getAdminHealth.mockImplementation(async () => {
			notifyAdminAuthorizationDenied(accountUser.uid);
			throw new Error('forbidden');
		});
		mount('/invitaciones');
		await restoreUser();
		await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' })); });
		expect(authMocks.signOut).toHaveBeenCalledWith(authMocks.auth);
		expect(screen.getByText('Pantalla de acceso')).toBeTruthy();
	});
});
