import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

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

export function AdminSidebar() {
	const location = useLocation();
	const invitationRouteActive = location.pathname.startsWith('/invitaciones');
	const invitationDetailActive = invitationRouteActive && location.pathname !== '/invitaciones' && location.pathname !== '/invitaciones/nueva' && location.pathname !== '/invitaciones/importar';
	const [expandedByUser, setExpandedByUser] = useState(false);
	const expanded = invitationRouteActive || expandedByUser;

	return (
		<aside className="admin-sidebar">
			<span className="admin-sidebar__accent" aria-hidden="true" />
			<svg className="admin-sidebar__waves" viewBox="0 0 250 180" preserveAspectRatio="none" aria-hidden="true">
				<path className="admin-sidebar__wave-band" d="M-24 137C48 151 91 137 132 103C174 68 194 34 274 11L274 39C211 55 188 80 150 113C103 153 57 174-24 163Z" />
				<path className="admin-sidebar__wave-edge" d="M-24 137C48 151 91 137 132 103C174 68 194 34 274 11" />
				<path className="admin-sidebar__wave-cross" d="M-20 158C50 172 94 145 133 111C172 77 207 63 270 53" />
			</svg>
			<NavLink className="admin-sidebar__brand" to="/">
				<span className="admin-sidebar__brand-mark" aria-hidden="true">B</span>
				<span className="admin-sidebar__brand-text">
					Boda-Admin
					<small>Panel administrativo</small>
				</span>
			</NavLink>

			<nav className="admin-sidebar__navigation" aria-label="Navegación principal">
				<NavLink className={navigationClassName} to="/" end>
					<span className="admin-sidebar__nav-icon"><HomeIcon /></span>
					Dashboard
				</NavLink>
				<div className={`admin-sidebar__group${invitationRouteActive ? ' admin-sidebar__group--active' : ''}`}>
					<button
						className="admin-sidebar__group-toggle"
						type="button"
						aria-expanded={expanded}
						aria-controls="admin-sidebar-invitations"
						onClick={() => setExpandedByUser((value) => !value)}
					>
						<span className="admin-sidebar__nav-icon"><InvitationIcon /></span>
						<span>Invitaciones</span>
						<ChevronIcon expanded={expanded} />
					</button>
					<div id="admin-sidebar-invitations" className={`admin-sidebar__submenu${expanded ? ' admin-sidebar__submenu--expanded' : ''}`}>
						<NavLink className={() => navigationClassName({ isActive: location.pathname === '/invitaciones' || invitationDetailActive })} to="/invitaciones" end>
							<span className="admin-sidebar__subnav-dot" aria-hidden="true" />
							Todas
						</NavLink>
						<NavLink className={navigationClassName} to="/invitaciones/nueva" end>
							<span className="admin-sidebar__subnav-dot" aria-hidden="true" />
							Nueva invitación
						</NavLink>
						<NavLink className={navigationClassName} to="/invitaciones/importar" end>
							<span className="admin-sidebar__subnav-dot" aria-hidden="true" />
							Importar
						</NavLink>
					</div>
				</div>
			</nav>

			<div className="admin-sidebar__footer">
				<span className="admin-sidebar__footer-icon"><PeopleIcon /></span>
				<p>Gestión de invitaciones<br />y confirmaciones</p>
			</div>
		</aside>
	);
}
