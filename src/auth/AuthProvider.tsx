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
				loading,
				login: async () => {
					await loginWithGoogle();
				},
				logout: async () => {
					await logoutFromFirebase();
				},
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}
