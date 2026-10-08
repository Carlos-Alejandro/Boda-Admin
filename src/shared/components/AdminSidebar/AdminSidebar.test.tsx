// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { User } from 'firebase/auth';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthContext } from '../../../auth/AuthContext';
import { AdminLayout } from '../../../layouts/AdminLayout/AdminLayout';
import { notify } from '../../notifications/notify';

let mobile = false;
let mediaChange: (() => void) | undefined;
const logout = vi.fn<() => Promise<void>>();
const accountUser = { displayName: 'María Pérez', email: 'maria@example.com' } as User;

function mount(path = '/') {
	return render(
		<AuthContext.Provider value={{ user: accountUser, loading: false, signingOut: false, login: vi.fn(), logout }}>
			<MemoryRouter initialEntries={[path]}>
				<Routes>
					<Route element={<AdminLayout />}>
						<Route path="/" element={<p>Dashboard actual</p>} />
						<Route path="/invitaciones" element={<p>Listado actual</p>} />
						<Route path="/invitaciones/archivadas" element={<p>Archivadas actuales</p>} />
						<Route path="/invitaciones/nueva" element={<p>Formulario actual</p>} />
						<Route path="/invitaciones/importar" element={<p>Importador actual</p>} />
						<Route path="/invitaciones/:id" element={<p>Detalle actual</p>} />
					</Route>
				</Routes>
			</MemoryRouter>
		</AuthContext.Provider>,
	);
}

function openDrawer() {
	const opener = screen.getByRole('button', { name: 'Abrir menú' });
	fireEvent.click(opener);
	return screen.getByRole('dialog', { name: 'Menú de navegación' });
}

describe('navegación responsive del Admin', () => {
	beforeEach(() => {
		mobile = false;
		mediaChange = undefined;
		logout.mockReset().mockResolvedValue(undefined);
		vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
			get matches() { return mobile; },
			addEventListener: (_type: string, listener: () => void) => { mediaChange = listener; },
			removeEventListener: () => { mediaChange = undefined; },
		})));
	});
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		document.body.style.overflow = '';
		document.documentElement.style.overflow = '';
	});

	it('conserva el sidebar desktop y sus enlaces sin mostrar la topbar', () => {
		mount('/invitaciones');
		expect(screen.queryByRole('button', { name: 'Abrir menú' })).toBeNull();
		expect(screen.queryByRole('dialog')).toBeNull();
		const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
		expect(within(nav).getByRole('link', { name: 'Dashboard' }).getAttribute('href')).toBe('/');
		expect(within(nav).getByRole('link', { name: 'Todas' }).className).toContain('admin-sidebar__link--active');
		expect(screen.getByRole('main').textContent).toContain('Listado actual');
	});

	it('muestra la cuenta de Firebase y ejecuta cerrar sesión desde el menú discreto', () => {
		const dismissNotifications = vi.spyOn(notify, 'dismiss');
		mount();
		expect(screen.getByText('María Pérez')).toBeTruthy();
		expect(screen.getByText('maria@example.com')).toBeTruthy();
		expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
		fireEvent.click(screen.getByRole('button', { name: 'Cuenta de María Pérez' }));
		expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
		fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
		expect(logout).toHaveBeenCalledOnce();
		expect(dismissNotifications).toHaveBeenCalledOnce();
		dismissNotifications.mockRestore();
	});

	it.each(['Boda-Admin', 'B'])('navega al Dashboard desde %s en el branding desktop', (target) => {
		mount('/invitaciones');
		const brand = screen.getByRole('link', { name: /Boda-Admin/ });
		expect(brand.getAttribute('href')).toBe('/');
		fireEvent.click(within(brand).getByText(target, { exact: true }));
		expect(screen.getByRole('main').textContent).toContain('Dashboard actual');
	});

	it.each([
		['texto', 'Boda-Admin'],
		['círculo', 'Boda-Admin, ir al Dashboard'],
	])('navega al Dashboard desde el %s de la barra móvil', (_part, name) => {
		mobile = true;
		mount('/invitaciones');
		const brand = screen.getByRole('link', { name });
		expect(brand.getAttribute('href')).toBe('/');
		brand.focus();
		fireEvent.click(brand);
		expect(screen.getByRole('main').textContent).toContain('Dashboard actual');
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(document.activeElement).toBe(brand);
	});

	it.each(['Boda-Admin', 'B'])('navega desde %s en el drawer y lo cierra', (target) => {
		mobile = true;
		mount('/invitaciones');
		const drawer = openDrawer();
		const brand = within(drawer).getByRole('link', { name: /Boda-Admin/ });
		expect(brand.getAttribute('href')).toBe('/');
		fireEvent.click(within(brand).getByText(target, { exact: true }));
		expect(screen.getByRole('main').textContent).toContain('Dashboard actual');
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(document.body.style.overflow).toBe('');
		expect(screen.getByRole('button', { name: 'Abrir menú' }).getAttribute('aria-expanded')).toBe('false');
	});

	it('en móvil inicia cerrado con barra compacta, navegación inerte y contenido disponible', () => {
		mobile = true;
		mount();
		const opener = screen.getByRole('button', { name: 'Abrir menú' });
		expect(opener.getAttribute('aria-expanded')).toBe('false');
		expect(opener.getAttribute('aria-controls')).toBe('admin-mobile-drawer');
		expect(document.getElementById('admin-mobile-drawer')?.hasAttribute('inert')).toBe(true);
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(screen.getByRole('main').textContent).toContain('Dashboard actual');
		expect(screen.getByRole('main').parentElement?.className).toContain('grid-rows-[auto_1fr]');
		expect(document.body.style.overflow).toBe('');
	});

	it('abre el drawer, bloquea el fondo y permite cerrar con X y recuperar el foco', () => {
		mobile = true;
		mount();
		const drawer = openDrawer();
		expect(screen.getByRole('button', { name: 'Abrir menú' }).getAttribute('aria-expanded')).toBe('true');
		expect(drawer.getAttribute('aria-modal')).toBe('true');
		expect(drawer.hasAttribute('inert')).toBe(false);
		expect(document.body.style.overflow).toBe('hidden');
		expect(document.documentElement.style.overflow).toBe('hidden');
		expect(document.querySelector('main')?.inert).toBe(true);
		expect(document.activeElement).toBe(within(drawer).getByRole('button', { name: 'Cerrar menú' }));
		fireEvent.click(within(drawer).getByRole('button', { name: 'Cerrar menú' }));
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(document.body.style.overflow).toBe('');
		expect(document.documentElement.style.overflow).toBe('');
		expect(document.querySelector('main')?.inert).toBe(false);
		expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Abrir menú' }));
	});

	it('cierra con overlay y con Escape', () => {
		mobile = true;
		mount();
		openDrawer();
		fireEvent.click(screen.getByRole('button', { name: 'Cerrar menú al tocar fuera' }));
		expect(screen.queryByRole('dialog')).toBeNull();
		openDrawer();
		fireEvent.keyDown(document, { key: 'Escape' });
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(document.body.style.overflow).toBe('');
	});

	it('mantiene el foco dentro del drawer mientras está abierto', () => {
		mobile = true;
		mount('/invitaciones');
		const drawer = openDrawer();
		const first = within(drawer).getByRole('link', { name: /Boda-Admin/ });
		const last = within(drawer).getByRole('button', { name: 'Cuenta de María Pérez' });
		last.focus();
		fireEvent.keyDown(document, { key: 'Tab' });
		expect(document.activeElement).toBe(first);
		fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
		expect(document.activeElement).toBe(last);

		fireEvent.click(last);
		const logoutButton = within(drawer).getByRole('button', { name: 'Cerrar sesión' });
		logoutButton.focus();
		fireEvent.keyDown(document, { key: 'Tab' });
		expect(document.activeElement).toBe(first);
		fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
		expect(document.activeElement).toBe(logoutButton);
	});

	it('mantiene la ruta activa, expande Invitaciones y cierra al navegar', () => {
		mobile = true;
		mount('/invitaciones/nueva');
		const drawer = openDrawer();
		const group = within(drawer).getByRole('button', { name: 'Invitaciones' });
		expect(group.getAttribute('aria-expanded')).toBe('true');
		expect(within(drawer).getByRole('link', { name: 'Nueva invitación' }).className).toContain('admin-sidebar__link--active');
		fireEvent.click(group);
		expect(group.getAttribute('aria-expanded')).toBe('false');
		fireEvent.click(group);
		expect(group.getAttribute('aria-expanded')).toBe('true');
		fireEvent.click(within(drawer).getByRole('link', { name: 'Importar' }));
		expect(screen.getByRole('main').textContent).toContain('Importador actual');
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(document.body.style.overflow).toBe('');
		const reopened = openDrawer();
		expect(within(reopened).getByRole('link', { name: 'Importar' }).className).toContain('admin-sidebar__link--active');
	});

	it('trata el detalle como Todas y cierra al cambiar a desktop', () => {
		mobile = true;
		mount('/invitaciones/123');
		const drawer = openDrawer();
		expect(within(drawer).getByRole('link', { name: 'Todas' }).className).toContain('admin-sidebar__link--active');
		mobile = false;
		act(() => mediaChange?.());
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(document.body.style.overflow).toBe('');
		expect(screen.getByRole('navigation', { name: 'Navegación principal' })).toBeTruthy();
	});

	it('mantiene Todas activa en la ruta de archivadas sin mostrar un enlace duplicado', () => {
		mount('/invitaciones/archivadas');
		const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
		expect(within(nav).queryByRole('link', { name: 'Archivadas' })).toBeNull();
		expect(within(nav).getAllByRole('link').map((link) => link.textContent?.trim())).toEqual([
			'Dashboard', 'Todas', 'Nueva invitación', 'Importar',
		]);
		expect(within(nav).getByRole('link', { name: 'Todas' }).className).toContain('admin-sidebar__link--active');
		expect(screen.getByRole('main').textContent).toContain('Archivadas actuales');
	});

	it('mantiene Todas seleccionada para el filtro de invitaciones activas', () => {
		mount('/invitaciones?estado=activas');
		const nav = screen.getByRole('navigation', { name: 'Navegación principal' });
		expect(within(nav).getByRole('link', { name: 'Todas' }).className).toContain('admin-sidebar__link--active');
		expect(within(nav).queryByRole('link', { name: 'Archivadas' })).toBeNull();
	});
});
