import { NavLink } from 'react-router-dom';

import './AdminSidebar.css';

const navigationClassName = ({ isActive }: { isActive: boolean }) =>
	`admin-sidebar__link${isActive ? ' admin-sidebar__link--active' : ''}`;

export function AdminSidebar() {
	return (
		<aside className="admin-sidebar">
			<NavLink className="admin-sidebar__brand" to="/">
				<span className="admin-sidebar__brand-mark" aria-hidden="true">B</span>
				<span className="admin-sidebar__brand-text">
					Boda Admin
					<small>Panel administrativo</small>
				</span>
			</NavLink>

			<nav className="admin-sidebar__navigation" aria-label="Navegación principal">
				<NavLink className={navigationClassName} to="/" end>
					<span className="admin-sidebar__nav-icon" aria-hidden="true">⌂</span>
					Dashboard
				</NavLink>
				<NavLink className={navigationClassName} to="/invitaciones" end>
					<span className="admin-sidebar__nav-icon" aria-hidden="true">◇</span>
					Invitaciones
				</NavLink>
				<NavLink className={navigationClassName} to="/invitaciones/nueva">
					<span className="admin-sidebar__nav-icon" aria-hidden="true">＋</span>
					Nueva invitación
				</NavLink>
			</nav>

			<p className="admin-sidebar__caption">Gestión de invitados y confirmaciones</p>
		</aside>
	);
}
