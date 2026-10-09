import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const firebaseMocks = vi.hoisted(() => ({
	initializeApp: vi.fn((config: unknown) => ({ config })),
	getAuth: vi.fn(() => ({})),
	connectAuthEmulator: vi.fn(),
}));

vi.mock('firebase/app', () => ({ initializeApp: firebaseMocks.initializeApp }));
vi.mock('firebase/auth', () => ({
	getAuth: firebaseMocks.getAuth,
	connectAuthEmulator: firebaseMocks.connectAuthEmulator,
}));

function stubLocalEnvironment(apiUrl = 'http://127.0.0.1:3000', publicUrl = 'http://127.0.0.1:5173') {
	vi.stubEnv('VITE_USE_FIREBASE_EMULATORS', 'true');
	vi.stubEnv('VITE_API_BASE_URL', apiUrl);
	vi.stubEnv('VITE_PUBLIC_INVITATION_BASE_URL', publicUrl);
}

describe('Firebase Auth emulator configuration', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();
	});

	afterEach(() => vi.unstubAllEnvs());

	it('uses demo-boda and the local Auth emulator when explicitly enabled', async () => {
		stubLocalEnvironment();

		await import('./firebase');

		expect(firebaseMocks.initializeApp).toHaveBeenCalledWith(
			expect.objectContaining({ projectId: 'demo-boda' }),
		);
		expect(firebaseMocks.connectAuthEmulator).toHaveBeenCalledWith(
			expect.anything(),
			'http://127.0.0.1:9099',
		);
	});

	it('rejects an API URL outside loopback in emulator mode', async () => {
		stubLocalEnvironment('https://api.example.com');

		await expect(import('./firebase')).rejects.toThrow('VITE_API_BASE_URL');
		expect(firebaseMocks.initializeApp).not.toHaveBeenCalled();
	});

	it('rejects a public invitation URL outside loopback in emulator mode', async () => {
		stubLocalEnvironment('http://127.0.0.1:3000', 'https://wedding.example.com');

		await expect(import('./firebase')).rejects.toThrow('VITE_PUBLIC_INVITATION_BASE_URL');
		expect(firebaseMocks.initializeApp).not.toHaveBeenCalled();
	});
});