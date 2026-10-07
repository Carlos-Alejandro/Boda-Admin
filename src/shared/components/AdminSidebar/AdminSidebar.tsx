import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import { useAuth } from '../../../auth/useAuth';
import { notify } from '../../notifications/notify';
import './AdminSidebar.css';

const navigationClassName = ({ isActive }: { isActive: boolean }) =>
	`admin-sidebar__link${isActive ? ' admin-sidebar__link--active' : ''}`;

function HomeIcon() {
	return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3.5 10.5 8.5-7 8.5 7" /><path d="M5.5 9.5v10h13v-10M9.5 19.5v-5h5v5" /></svg>;
}

function InvitationIcon() {
	return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 4 8 4.5-8 4.5-8-4.5L12 4Z" /><path d="m4 12 8 4.5 8-4.5M4 15.5l8 4.5 8-4.5" /></svg>;
}

function PeopleIcon() {
	return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.5-3.2 2.3-5 5.5-5s5 1.8 5.5 5M16 11c2.2 0 3.7 1.2 4.2 3.5M16 5.5a2.5 2.5 0 0 1 0 5" /></svg>;
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
	return <svg className={`admin-sidebar__chevron${expanded ? ' admin-sidebar__chevron--expanded' : ''}`} viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5" /></svg>;
}

function AccountChevron({ expanded }: { expanded: boolean }) {
	return <svg className={`admin-sidebar__account-chevron${expanded ? ' admin-sidebar__account-chevron--expanded' : ''}`} viewBox="0 0 24 24" aria-hidden="true"><path d="m7 9 5 5 5-5" /></svg>;
}

const mobileNavigationQuery = '(max-width: 56.25rem)';

export function AdminSidebar() {
	const location = useLocation();
	const { user, logout, signingOut } = useAuth();
	const [isMobile, setIsMobile] = useState(() => window.matchMedia?.(mobileNavigationQuery).matches ?? false);
	const [accountMenuState, setAccountMenuState] = useState({ route: location.key, open: false });
	const [drawerState, setDrawerState] = useState({ route: location.key, open: false });
	const isDrawerOpen = isMobile && drawerState.route === location.key && drawerState.open;
	const openButtonRef = useRef<HTMLButtonElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const drawerRef = useRef<HTMLElement>(null);
	const accountRef = useRef<HTMLDivElement>(null);
	const accountTriggerRef = useRef<HTMLButtonElement>(null);
	const accountMenuOpen = accountMenuState.route === location.key && accountMenuState.open;
	const setAccountMenuOpen = useCallback((open: boolean) => setAccountMenuState({ route: location.key, open }), [location.key]);
	const invitationRouteActive = location.pathname.startsWith('/invitaciones');
	const invitationDetailActive = invitationRouteActive && location.pathname !== '/invitaciones' && location.pathname !== '/invitaciones/nueva' && location.pathname !== '/invitaciones/importar';
	const [navigationState, setNavigationState] = useState({ route: location.pathname, expanded: invitationRouteActive });
	const expanded = navigationState.route === location.pathname ? navigationState.expanded : invitationRouteActive;
	const closeDrawer = useCallback(() => {
		setDrawerState((state) => ({ ...state, open: false }));
		if (isDrawerOpen) openButtonRef.current?.focus();
	}, [isDrawerOpen]);
	const accountLabel = user?.displayName?.trim() || user?.email?.trim() || 'Cuenta';
	const accountEmail = user?.displayName?.trim() ? user.email : null;
	const accountInitial = user?.displayName?.trim()?.[0] || user?.email?.trim()?.[0];
	const isLoggingOut = signingOut;

	const handleLogout = async () => {
		if (isLoggingOut) return;
		setAccountMenuOpen(false);
		notify.dismiss();
		try {
			await logout();
		} catch {
			notify.error('No se pudo cerrar sesión', { description: 'Inténtalo de nuevo.' });
		}
	};

	useEffect(() => {
		if (!accountMenuOpen) return;
		const closeOnOutsidePointer = (event: PointerEvent) => {
			if (!accountRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			setAccountMenuOpen(false);
			accountTriggerRef.current?.focus();
		};
		document.addEventListener('pointerdown', closeOnOutsidePointer);
		document.addEventListener('keydown', closeOnEscape);
		return () => {
			document.removeEventListener('pointerdown', closeOnOutsidePointer);
			document.removeEventListener('keydown', closeOnEscape);
		};
	}, [accountMenuOpen, setAccountMenuOpen]);

	useEffect(() => {
		const media = window.matchMedia?.(mobileNavigationQuery);
		if (!media) return;
		const handleChange = () => {
			setIsMobile(media.matches);
			setDrawerState((state) => ({ ...state, open: false }));
		};
		media.addEventListener('change', handleChange);
		return () => media.removeEventListener('change', handleChange);
	}, []);

	useEffect(() => {
		if (!isDrawerOpen) return;
		const previousOverflow = document.body.style.overflow;
		const previousRootOverflow = document.documentElement.style.overflow;
		const pageContent = drawerRef.current?.parentElement?.querySelector('main');
		const previousPageInert = pageContent?.inert;
		document.body.style.overflow = 'hidden';
		document.documentElement.style.overflow = 'hidden';
		if (pageContent) pageContent.inert = true;
		closeButtonRef.current?.focus();
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				closeDrawer();
			} else if (event.key === 'Tab') {
				const focusable = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []).filter((element) => !element.closest('[inert]'));
				const first = focusable[0];
				const last = focusable.at(-1);
				if (!first || !last) return;
				if (event.shiftKey && document.activeElement === first) {
					event.preventDefault();
					last.focus();
				} else if (!event.shiftKey && document.activeElement === last) {
					event.preventDefault();
					first.focus();
				}
			}
		};
		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			document.documentElement.style.overflow = previousRootOverflow;
			if (pageContent) pageContent.inert = previousPageInert ?? false;
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [closeDrawer, isDrawerOpen]);

	return (
		<>
			<header className="admin-mobile-topbar" hidden={!isMobile}>
				<button ref={openButtonRef} className="admin-mobile-topbar__menu" type="button" aria-label="Abrir menú" aria-controls="admin-mobile-drawer" aria-expanded={isDrawerOpen} onClick={() => setDrawerState({ route: location.key, open: true })}>
					<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
				</button>
				<NavLink className="admin-mobile-topbar__title" to="/" onClick={closeDrawer}>Boda-Admin</NavLink>
				<NavLink className="admin-sidebar__brand-mark admin-mobile-topbar__mark" to="/" aria-label="Boda-Admin, ir al Dashboard" onClick={closeDrawer}>B</NavLink>
			</header>
			<button className="admin-mobile-overlay" type="button" hidden={!isDrawerOpen} aria-label="Cerrar menú al tocar fuera" tabIndex={-1} onClick={closeDrawer} />
			<aside ref={drawerRef} id="admin-mobile-drawer" className={`admin-sidebar${isDrawerOpen ? ' admin-sidebar--open' : ''}`} role={isMobile ? 'dialog' : undefined} aria-modal={isDrawerOpen ? true : undefined} aria-label={isMobile ? 'Menú de navegación' : undefined} aria-hidden={isMobile && !isDrawerOpen ? true : undefined} inert={isMobile && !isDrawerOpen}>
			<span className="admin-sidebar__accent" aria-hidden="true" />
			<svg className="admin-sidebar__waves" viewBox="0 0 250 180" preserveAspectRatio="none" aria-hidden="true">
				<path className="admin-sidebar__wave-band" d="M-24 137C48 151 91 137 132 103C174 68 194 34 274 11L274 39C211 55 188 80 150 113C103 153 57 174-24 163Z" />
				<path className="admin-sidebar__wave-edge" d="M-24 137C48 151 91 137 132 103C174 68 194 34 274 11" />
				<path className="admin-sidebar__wave-cross" d="M-20 158C50 172 94 145 133 111C172 77 207 63 270 53" />
			</svg>
			<NavLink className="admin-sidebar__brand" to="/" onClick={closeDrawer}>
				<span className="admin-sidebar__brand-mark" aria-hidden="true">B</span>
				<span className="admin-sidebar__brand-text">
					Boda-Admin
					<small>Panel administrativo</small>
				</span>
			</NavLink>
			<button ref={closeButtonRef} className="admin-sidebar__close" type="button" aria-label="Cerrar menú" onClick={closeDrawer}>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19" /></svg>
			</button>

			<nav className="admin-sidebar__navigation" aria-label="Navegación principal">
				<NavLink className={navigationClassName} to="/" end onClick={closeDrawer}>
					<span className="admin-sidebar__nav-icon"><HomeIcon /></span>
					Dashboard
				</NavLink>
				<div className={`admin-sidebar__group${invitationRouteActive ? ' admin-sidebar__group--active' : ''}`}>
					<button
						className="admin-sidebar__group-toggle"
						type="button"
						aria-expanded={expanded}
						aria-controls="admin-sidebar-invitations"
						onClick={() => setNavigationState({ route: location.pathname, expanded: !expanded })}
					>
						<span className="admin-sidebar__nav-icon"><InvitationIcon /></span>
						<span>Invitaciones</span>
						<ChevronIcon expanded={expanded} />
					</button>
					<div id="admin-sidebar-invitations" inert={!expanded} className={`admin-sidebar__submenu${expanded ? ' admin-sidebar__submenu--expanded' : ''}`}>
						<NavLink className={() => navigationClassName({ isActive: location.pathname === '/invitaciones' || invitationDetailActive })} to="/invitaciones" end onClick={closeDrawer}>
							<span className="admin-sidebar__subnav-dot" aria-hidden="true" />
							Todas
						</NavLink>
						<NavLink className={navigationClassName} to="/invitaciones/nueva" end onClick={closeDrawer}>
							<span className="admin-sidebar__subnav-dot" aria-hidden="true" />
							Nueva invitación
						</NavLink>
						<NavLink className={navigationClassName} to="/invitaciones/importar" end onClick={closeDrawer}>
							<span className="admin-sidebar__subnav-dot" aria-hidden="true" />
							Importar
						</NavLink>
					</div>
				</div>
			</nav>

			<div className="admin-sidebar__footer">
				<div ref={accountRef} className="admin-sidebar__account">
					<button
						ref={accountTriggerRef}
						className="admin-sidebar__account-trigger"
						type="button"
						aria-label={`Cuenta de ${accountLabel}`}
						aria-expanded={accountMenuOpen}
						aria-controls="admin-sidebar-account-menu"
						disabled={isLoggingOut}
						onClick={() => setAccountMenuOpen(!accountMenuOpen)}
					>
						<span className="admin-sidebar__account-avatar" aria-hidden="true">
							{accountInitial ? accountInitial.toLocaleUpperCase() : <PeopleIcon />}
						</span>
						<span className="admin-sidebar__account-copy">
							<strong>{accountLabel}</strong>
							{accountEmail && <small>{accountEmail}</small>}
						</span>
						<AccountChevron expanded={accountMenuOpen} />
					</button>
					{accountMenuOpen && <div id="admin-sidebar-account-menu" className="admin-sidebar__account-menu">
						<button className="admin-sidebar__account-logout" type="button" disabled={isLoggingOut} onClick={() => { void handleLogout(); }}>
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10M14 16l4-4-4-4M18 12H9" /></svg>
							{isLoggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
						</button>
					</div>}
				</div>
			</div>
			</aside>
		</>
	);
}
