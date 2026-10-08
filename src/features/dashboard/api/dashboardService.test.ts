// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';

vi.hoisted(() => { vi.stubEnv('VITE_API_BASE_URL', 'https://api.test'); });
const authMock = vi.hoisted(() => ({ currentUser: { getIdToken: vi.fn().mockResolvedValue('token') } }));
vi.mock('../../../config/firebase', () => ({ auth: authMock }));

import { getAdminHealth } from './dashboardService';

afterEach(() => vi.unstubAllGlobals());

it('acepta solo la respuesta de salud administrativa definida por el contrato', async () => {
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
		status: 'ok', service: 'boda-api', authenticated: true,
	}), { status: 200 })));
	await expect(getAdminHealth()).resolves.toEqual({ status: 'ok', service: 'boda-api', authenticated: true });
});

it.each([
	{ status: 'healthy', service: 'boda-api', authenticated: true },
	{ status: 'ok', service: 'other', authenticated: true },
	{ status: 'ok', service: 'boda-api', authenticated: false },
	{ status: 'ok', service: 'boda-api' },
])('rechaza campos incorrectos o incompletos en health', async responseBody => {
	vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(responseBody), { status: 200 })));
	await expect(getAdminHealth()).rejects.toMatchObject({ name: 'ApiResponseError', status: 200 });
});
