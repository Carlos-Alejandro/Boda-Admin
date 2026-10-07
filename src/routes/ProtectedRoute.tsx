import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';

export function ProtectedRoute() {
	const { user, loading, signingOut } = useAuth();
	const location = useLocation();

	if (loading) {
		return <p className="route-loading" role="status">{signingOut ? 'Cerrando sesión...' : 'Restaurando sesión...'}</p>;
	}

	if (!user) {
		return <Navigate to="/login" replace state={{ from: location }} />;
	}

	return <Outlet />;
}
