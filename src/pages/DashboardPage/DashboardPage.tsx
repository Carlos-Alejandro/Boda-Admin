import { useState } from 'react';

import { useAuth } from '../../auth/useAuth';

export function DashboardPage() {
	const { user, logout } = useAuth();
	const [loggingOut, setLoggingOut] = useState(false);

	const handleLogout = async () => {
		try {
			setLoggingOut(true);
			await logout();
		} finally {
			setLoggingOut(false);
		}
	};

	return (
		<section aria-labelledby="dashboard-title">
			<h1 id="dashboard-title">Dashboard</h1>
			<p>Sesión iniciada correctamente.</p>
			{user?.displayName && <p>{user.displayName}</p>}
			{user?.email && <p>{user.email}</p>}

			<button type="button" disabled={loggingOut} onClick={handleLogout}>
				{loggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
			</button>
		</section>
	);
}
