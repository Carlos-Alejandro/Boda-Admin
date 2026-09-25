// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import type { Toast, ToastType } from 'react-hot-toast';
import { afterEach, describe, expect, it } from 'vitest';

import { AdminToaster, ToastTimeRemaining } from './AdminToaster';
import { NOTIFICATION_DURATIONS } from './notificationConfig';

function toast(type: ToastType, duration: number): Toast {
	return {
		type,
		duration,
		id: `toast-${type}`,
		message: 'Mensaje',
		pauseDuration: 0,
		createdAt: Date.now(),
		visible: true,
		dismissed: false,
		ariaProps: { role: 'status', 'aria-live': 'polite' },
	};
}

afterEach(cleanup);

describe('notificaciones globales', () => {
	it('centraliza duraciones coherentes por semántica', () => {
		expect(NOTIFICATION_DURATIONS.success).toBe(NOTIFICATION_DURATIONS.info);
		expect(NOTIFICATION_DURATIONS.warning).toBeGreaterThan(NOTIFICATION_DURATIONS.success);
		expect(NOTIFICATION_DURATIONS.error).toBeGreaterThan(NOTIFICATION_DURATIONS.warning);
	});

	it('muestra barra temporal solo para notificaciones con duración finita', () => {
		const success = render(<ToastTimeRemaining toast={toast('success', NOTIFICATION_DURATIONS.success)} />);
		expect(success.container.querySelector('.admin-toast__time-remaining')).toBeTruthy();
		success.unmount();

		const loading = render(<ToastTimeRemaining toast={toast('loading', Number.POSITIVE_INFINITY)} />);
		expect(loading.container.querySelector('.admin-toast__time-track')).toBeNull();
	});

	it('mantiene una única raíz Toaster configurada', () => {
		const { container } = render(<AdminToaster />);
		expect(container.querySelectorAll('[data-rht-toaster]')).toHaveLength(1);
	});
});
