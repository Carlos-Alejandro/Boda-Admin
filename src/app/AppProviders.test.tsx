// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';

import { AppProviders } from './AppProviders';

vi.mock('../auth/AuthProvider', () => ({
	AuthProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('../shared/notifications/AdminToaster', () => ({
	AdminToaster: () => <div data-testid="global-toaster" />,
}));

afterEach(cleanup);

it('monta una sola instancia global del sistema de notificaciones', () => {
	render(<AppProviders><main>Contenido</main></AppProviders>);

	expect(screen.getAllByTestId('global-toaster')).toHaveLength(1);
	expect(screen.getByRole('main').textContent).toBe('Contenido');
});
