import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import { UnauthorizedAccessPage } from '../pages/UnauthorizedAccessPage/UnauthorizedAccessPage';
import { AuthorizationErrorPage } from '../pages/AuthorizationErrorPage/AuthorizationErrorPage';

export function ProtectedRoute() {
	const { user, loading, signingOut, authorization, retryAuthorization } = useAuth();
	const location = useLocation();

	if (loading) {
		return <p className="route-loading" role="status">{signingOut ? 'Cerrando sesión...' : 'Restaurando sesión...'}</p>;
	}

	if (!user) {
		return <Navigate to="/login" replace state={{ from: location }} />;
	}
	if (authorization === 'checking') {
		return <p className="route-loading" role="status">Comprobando autorización...</p>;
	}
	if (authorization === 'unauthorized') return <UnauthorizedAccessPage />;
	if (authorization === 'error') return <AuthorizationErrorPage onRetry={retryAuthorization} />;

	return <Outlet />;
}
