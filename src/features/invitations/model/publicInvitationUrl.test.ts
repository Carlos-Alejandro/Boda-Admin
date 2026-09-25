import { afterEach, expect, it, vi } from 'vitest';
import { getPublicInvitationUrl } from './publicInvitationUrl';

afterEach(() => vi.unstubAllEnvs());

it('construye el enlace desde la variable configurable, normaliza slash y usa el id real', () => {
	vi.stubEnv('VITE_PUBLIC_INVITATION_BASE_URL', 'https://wedding.test/');
	expect(getPublicInvitationUrl('ABC 123')).toBe('https://wedding.test/invitacion/ABC%20123');
});

it('falla explícitamente cuando no hay dominio público configurado', () => {
	vi.stubEnv('VITE_PUBLIC_INVITATION_BASE_URL', '');
	expect(() => getPublicInvitationUrl('ABC')).toThrow('VITE_PUBLIC_INVITATION_BASE_URL');
});
