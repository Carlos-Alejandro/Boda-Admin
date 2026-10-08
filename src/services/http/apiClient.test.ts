// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => { vi.stubEnv('VITE_API_BASE_URL', 'https://api.test'); });

const authMocks = vi.hoisted(() => ({
	currentUser: { uid: 'auth-user', getIdToken: vi.fn().mockResolvedValue('firebase-test-token') },
}));

vi.mock('../../config/firebase', () => ({ auth: authMocks }));

import { onAdminAuthenticationFailed, onAdminAuthorizationDenied } from '../../auth/authorizationEvents';
import { apiRequest, ApiError } from './apiClient';

describe('apiRequest authorization events', () => {
	let forbiddenCalls: number;
	let unauthenticatedCalls: number;
	let forbidden: (requestUid: string) => void;
	let unauthenticated: (requestUid: string) => void;

	beforeEach(() => {
		forbiddenCalls = 0;
		unauthenticatedCalls = 0;
		forbidden = (_requestUid: string) => { forbiddenCalls++; };
		unauthenticated = (_requestUid: string) => { unauthenticatedCalls++; };
		vi.stubGlobal('fetch', vi.fn());
	});
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('notifies the app when a protected admin request receives 403', async () => {
		const stopForbidden = onAdminAuthorizationDenied(forbidden);
		const stopUnauthenticated = onAdminAuthenticationFailed(unauthenticated);
		vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 403 }));
		await expect(apiRequest('/api/admin/invitations')).rejects.toMatchObject({ status: 403 });
		expect(forbiddenCalls).toBe(1);
		expect(unauthenticatedCalls).toBe(0);
		stopForbidden();
		stopUnauthenticated();
	});

	it('treats 401 as an authentication failure, not a permission revocation', async () => {
		const stopForbidden = onAdminAuthorizationDenied(forbidden);
		const stopUnauthenticated = onAdminAuthenticationFailed(unauthenticated);
		vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 401 }));
		await expect(apiRequest('/api/admin/health')).rejects.toBeInstanceOf(ApiError);
		expect(unauthenticatedCalls).toBe(1);
		expect(forbiddenCalls).toBe(0);
		stopForbidden();
		stopUnauthenticated();
	});

	it('does not treat public RSVP 403 responses as admin permission revocation', async () => {
		const stopForbidden = onAdminAuthorizationDenied(forbidden);
		vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 403 }));
		await expect(apiRequest('/api/public/invitations/code/rsvp', { method: 'POST' })).rejects.toMatchObject({ status: 403 });
		expect(forbiddenCalls).toBe(0);
		stopForbidden();
	});

	it('does not treat network errors as a permission revocation', async () => {
		const stopForbidden = onAdminAuthorizationDenied(forbidden);
		vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
		await expect(apiRequest('/api/admin/invitations')).rejects.toThrow('Failed to fetch');
		expect(forbiddenCalls).toBe(0);
		stopForbidden();
	});
});
