// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { toast as toastApi, type Toast, type ToastType } from 'react-hot-toast';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

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

	it('eleva el toaster mientras hay notificaciones y lo oculta al descartarlas', async () => {
		vi.stubGlobal('matchMedia', () => ({ matches: true }));
		const originalShowPopover = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'showPopover');
		const originalHidePopover = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidePopover');
		const showPopover = vi.fn();
		const hidePopover = vi.fn();
		Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value: showPopover });
		Object.defineProperty(HTMLElement.prototype, 'hidePopover', { configurable: true, value: hidePopover });

		try {
			const { container } = render(<AdminToaster />);
			const layer = container.querySelector('.admin-toaster-layer');
			expect(layer?.getAttribute('popover')).toBe('manual');

			const id = toastApi.success('Enlace copiado', { duration: Number.POSITIVE_INFINITY });
			await waitFor(() => expect(showPopover).toHaveBeenCalledTimes(1));

			toastApi.dismiss(id);
			await waitFor(() => expect(hidePopover).toHaveBeenCalledTimes(1));
		} finally {
			if (originalShowPopover) Object.defineProperty(HTMLElement.prototype, 'showPopover', originalShowPopover);
			else Reflect.deleteProperty(HTMLElement.prototype, 'showPopover');
			if (originalHidePopover) Object.defineProperty(HTMLElement.prototype, 'hidePopover', originalHidePopover);
			else Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover');
		}
	});
});
