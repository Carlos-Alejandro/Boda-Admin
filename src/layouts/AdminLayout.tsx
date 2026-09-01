import { NavLink, Outlet } from 'react-router-dom';

export function AdminLayout() {
	return (
		<div className="admin-shell">
			<aside className="admin-sidebar">
				<NavLink className="admin-brand" to="/">
					<span className="admin-brand-mark" aria-hidden="true">
						B
					</span>
					<span>
						Boda Admin
						<small>Panel administrativo</small>
					</span>
				</NavLink>

				<nav className="admin-navigation" aria-label="Navegación principal">
					<NavLink to="/" end>
						<span className="nav-icon" aria-hidden="true">⌂</span>
						Dashboard
					</NavLink>
					<NavLink to="/invitaciones" end>
						<span className="nav-icon" aria-hidden="true">◇</span>
						Invitaciones
					</NavLink>
					<NavLink to="/invitaciones/nueva">
						<span className="nav-icon" aria-hidden="true">＋</span>
						Nueva invitación
					</NavLink>
				</nav>

				<p className="sidebar-caption">Gestión de invitados y confirmaciones</p>
			</aside>

			<div className="admin-workspace">
				<header className="admin-header">
					<div className="admin-header-copy">
						<strong>Boda-Admin</strong>
						<span>Gestión de invitaciones y confirmaciones</span>
					</div>
				</header>

				<main className="admin-content">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
