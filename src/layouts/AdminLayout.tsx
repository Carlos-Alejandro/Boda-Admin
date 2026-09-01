import { NavLink, Outlet } from 'react-router-dom';

export function AdminLayout() {
	return (
		<div className="admin-shell">
			<header className="admin-header">
				<strong>Boda Admin</strong>

				<nav className="admin-navigation" aria-label="Navegación principal">
					<NavLink to="/" end>
						Dashboard
					</NavLink>
					<NavLink to="/invitaciones">Invitaciones</NavLink>
				</nav>
			</header>

			<main className="admin-content">
				<Outlet />
			</main>
		</div>
	);
}
