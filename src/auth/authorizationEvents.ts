type AuthorizationListener = (requestUid: string) => void;

const forbiddenListeners = new Set<AuthorizationListener>();
const authenticationFailureListeners = new Set<AuthorizationListener>();

export function onAdminAuthorizationDenied(listener: AuthorizationListener) {
	forbiddenListeners.add(listener);
	return () => { forbiddenListeners.delete(listener); };
}

export function notifyAdminAuthorizationDenied(requestUid: string) {
	for (const listener of forbiddenListeners) listener(requestUid);
}

export function onAdminAuthenticationFailed(listener: AuthorizationListener) {
	authenticationFailureListeners.add(listener);
	return () => { authenticationFailureListeners.delete(listener); };
}

export function notifyAdminAuthenticationFailed(requestUid: string) {
	for (const listener of authenticationFailureListeners) listener(requestUid);
}
