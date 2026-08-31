import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';

export function PublicOnlyRoute() {
	const { user, loading } = useAuth();

	if (loading) {
		return <p className="route-loading">Restaurando sesión...</p>;
	}

	if (user) {
		return <Navigate to="/" replace />;
	}

	return <Outlet />;
}
