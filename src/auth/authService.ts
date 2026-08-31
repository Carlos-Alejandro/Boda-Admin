import { FirebaseError } from 'firebase/app';
import {
	GoogleAuthProvider,
	signInWithPopup,
	signOut,
} from 'firebase/auth';

import { auth } from '../config/firebase';

const googleProvider = new GoogleAuthProvider();

export function loginWithGoogle() {
	return signInWithPopup(auth, googleProvider);
}

export function logoutFromFirebase() {
	return signOut(auth);
}

export function getSafeAuthErrorCode(error: unknown) {
	if (error instanceof FirebaseError && error.code.startsWith('auth/')) {
		return error.code;
	}

	return 'auth/unknown';
}
