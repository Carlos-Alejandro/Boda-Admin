import { type ReactNode, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';

import { auth } from '../config/firebase';
import { AuthContext } from './AuthContext';
import { loginWithGoogle, logoutFromFirebase } from './authService';

interface AuthProviderProps {
	children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [signingOut, setSigningOut] = useState(false);

	useEffect(() => {
		return onAuthStateChanged(auth, (currentUser) => {
			setUser(currentUser);
			setLoading(false);
		});
	}, []);

	return (
		<AuthContext.Provider
			value={{
				user,
				loading: loading || signingOut,
				signingOut,
				login: async () => {
					await loginWithGoogle();
				},
				logout: async () => {
					setSigningOut(true);
					try {
						await logoutFromFirebase();
						setUser(null);
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
