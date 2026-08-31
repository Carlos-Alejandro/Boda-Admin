import { auth } from '../../config/firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
	throw new Error('Falta la variable VITE_API_BASE_URL.');
}

export async function apiRequest<T>(
	path: string,
	options: RequestInit = {},
): Promise<T> {
	const user = auth.currentUser;

	if (!user) {
		throw new Error('No hay una sesión autenticada.');
	}

	const idToken = await user.getIdToken();

	const response = await fetch(`${API_BASE_URL}${path}`, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${idToken}`,
			...options.headers,
		},
	});

	if (!response.ok) {
		throw new Error(`La API respondió con estado ${response.status}.`);
	}

	return response.json() as Promise<T>;
}