import { auth } from '../../config/firebase';
import {
	notifyAdminAuthenticationFailed,
	notifyAdminAuthorizationDenied,
} from '../../auth/authorizationEvents';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
	throw new Error('Falta la variable VITE_API_BASE_URL.');
}

export class ApiError extends Error {
	readonly status: number;
	readonly validationMessage?: string;
	readonly code?: string;
	readonly mayHaveCompleted: boolean;

	constructor(status: number, validationMessage?: string, code?: string, mayHaveCompleted = status === 408 || status >= 500) {
		super(`La API respondió con estado ${status}.`);
		this.name = 'ApiError';
		this.status = status;
		this.validationMessage = validationMessage;
		this.code = code;
		this.mayHaveCompleted = mayHaveCompleted;
	}
}

export class ApiResponseError extends Error {
	readonly status: number;
	readonly mayHaveCompleted: boolean;

	constructor(status: number, mayHaveCompleted: boolean) {
		super('La API devolvió una respuesta exitosa que no cumple el contrato esperado.');
		this.name = 'ApiResponseError';
		this.status = status;
		this.mayHaveCompleted = mayHaveCompleted;
	}
}

export class ApiOutcomeUnknownError extends Error {
	readonly mayHaveCompleted = true;

	constructor() {
		super('No se pudo confirmar el resultado de la operación.');
		this.name = 'ApiOutcomeUnknownError';
	}
}

type ApiResponseParser<T> = (value: unknown) => T;

export function apiRequest(
	path: string,
	options?: RequestInit,
	expectedStatuses?: readonly number[],
): Promise<unknown>;
export function apiRequest<T>(
	path: string,
	options: RequestInit,
	expectedStatuses: readonly number[],
	parseResponse: ApiResponseParser<T>,
): Promise<T>;
export async function apiRequest<T>(
	path: string,
	options: RequestInit = {},
	expectedStatuses: readonly number[] = [200],
	parseResponse?: ApiResponseParser<T>,
): Promise<T | unknown> {
	const user = auth.currentUser;

	if (!user) {
		throw new Error('No hay una sesión autenticada.');
	}

	const idToken = await user.getIdToken();
	options.signal?.throwIfAborted();
	const isMutation = !['GET', 'HEAD'].includes((options.method ?? 'GET').toUpperCase());

	let response: Response;
	try {
		response = await fetch(`${API_BASE_URL}${path}`, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${idToken}`,
				...options.headers,
			},
		});
	} catch (error) {
		if (isMutation) throw new ApiOutcomeUnknownError();
		throw error;
	}

	if (!response.ok) {
		if (path.startsWith('/api/admin/')) {
			if (response.status === 401) notifyAdminAuthenticationFailed(user.uid);
			if (response.status === 403) notifyAdminAuthorizationDenied(user.uid);
		}
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
		throw new ApiError(response.status, validationMessage, code, isMutation && (response.status === 408 || response.status >= 500));
	}

	if (!expectedStatuses.includes(response.status)) {
		throw new ApiError(response.status, undefined, undefined, isMutation);
	}
	if (!parseResponse) {
		const body: unknown = await response.json();
		return body;
	}
	try {
		const body: unknown = await response.json();
		return parseResponse(body);
	} catch {
		throw new ApiResponseError(response.status, isMutation);
	}
}
