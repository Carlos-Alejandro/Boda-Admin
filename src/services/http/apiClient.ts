import { auth } from '../../config/firebase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
	throw new Error('Falta la variable VITE_API_BASE_URL.');
}

export class ApiError extends Error {
	readonly status: number;
	readonly validationMessage?: string;
	readonly code?: string;

	constructor(status: number, validationMessage?: string, code?: string) {
		super(`La API respondió con estado ${status}.`);
		this.name = 'ApiError';
		this.status = status;
		this.validationMessage = validationMessage;
		this.code = code;
	}
}

export async function apiRequest<T>(
	path: string,
	options: RequestInit = {},
	expectedStatuses?: readonly number[],
): Promise<T> {
	const user = auth.currentUser;

	if (!user) {
		throw new Error('No hay una sesión autenticada.');
	}

	const idToken = await user.getIdToken();
	options.signal?.throwIfAborted();

	const response = await fetch(`${API_BASE_URL}${path}`, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${idToken}`,
			...options.headers,
		},
	});

	if (!response.ok) {
		let validationMessage: string | undefined;
		let code: string | undefined;
		if (response.status === 400 || response.status === 409) {
			try {
				const payload: unknown = await response.json();
				if (typeof payload === 'object' && payload !== null && 'error' in payload) {
					const error = payload.error;
					if (typeof error === 'object' && error !== null && 'code' in error &&
						error.code === 'IDEMPOTENCY_CONFLICT') code = error.code;
					if (response.status === 400 && typeof error === 'object' && error !== null &&
						'code' in error && error.code === 'VALIDATION_ERROR' &&
						'message' in error && typeof error.message === 'string' &&
						error.message.trim() && error.message.length <= 1000) {
						validationMessage = error.message;
					}
				}
			} catch { /* Keep the HTTP status even when the error body is unreadable. */ }
		}
		throw new ApiError(response.status, validationMessage, code);
	}

	if (expectedStatuses && !expectedStatuses.includes(response.status)) {
		throw new ApiError(response.status);
	}
	return response.json() as Promise<T>;
}
