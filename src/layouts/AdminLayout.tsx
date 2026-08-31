import { Outlet } from 'react-router-dom';

export function AdminLayout() {
	return (
		<div className="admin-shell">
			<header className="admin-header">
				<strong>Boda Admin</strong>
			</header>

			<main className="admin-content">
				<Outlet />
			</main>
		</div>
	);
}
