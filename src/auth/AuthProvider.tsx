import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from '../config/firebase';
import { getAdminHealth } from '../features/dashboard/api/dashboardService';
import { AuthContext } from './AuthContext';
import { loginWithGoogle, logoutFromFirebase } from './authService';
import { onAdminAuthenticationFailed, onAdminAuthorizationDenied } from './authorizationEvents';

interface AuthProviderProps {
	children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [signingOut, setSigningOut] = useState(false);
	const [authorization, setAuthorization] = useState<'checking' | 'authorized' | 'unauthorized' | 'error'>('checking');
	const verificationEpoch = useRef(0);
	const activeUid = useRef<string | null>(null);

	const checkAuthorization = useCallback(async (epoch: number) => {
		try {
			const health = await getAdminHealth();
			if (health.authenticated !== true) throw new Error('El backend no confirmó la autorización.');
			if (verificationEpoch.current === epoch) setAuthorization('authorized');
		} catch {
			if (verificationEpoch.current !== epoch) return;
			// The API client handles 401 and 403 through auth events. Any remaining
			// failure means authorization could not be verified.
			setAuthorization('error');
		}
	}, []);

	const handleAuthenticationFailure = useCallback((requestUid: string) => {
		if (activeUid.current !== requestUid) return;
		++verificationEpoch.current;
		setAuthorization('checking');
		void logoutFromFirebase().then(() => {
			setUser(null);
		}).catch(() => {
			setAuthorization('error');
		});
	}, []);

	useEffect(() => {
		const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
			const epoch = ++verificationEpoch.current;
			activeUid.current = currentUser?.uid ?? null;
			setUser(currentUser);
			if (!currentUser) {
				setAuthorization('checking');
				setLoading(false);
				return;
			}
			setAuthorization('checking');
			setLoading(false);
			void checkAuthorization(epoch);
		});
		return () => {
			unsubscribe();
		};
	}, [checkAuthorization]);

	useEffect(() => onAdminAuthorizationDenied((requestUid) => {
		if (activeUid.current !== requestUid) return;
		++verificationEpoch.current;
		setAuthorization('unauthorized');
	}), []);

	useEffect(() => onAdminAuthenticationFailed(handleAuthenticationFailure), [handleAuthenticationFailure]);

	const retryAuthorization = () => {
		if (!user) return;
		const epoch = ++verificationEpoch.current;
		setAuthorization('checking');
		void checkAuthorization(epoch);
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				loading: loading || signingOut,
				signingOut,
				authorization,
				retryAuthorization,
				login: async () => {
					await loginWithGoogle();
				},
				logout: async () => {
					setSigningOut(true);
					try {
						await logoutFromFirebase();
						activeUid.current = null;
						setUser(null);
						setAuthorization('checking');
					} finally {
						setSigningOut(false);
					}
				},
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}
