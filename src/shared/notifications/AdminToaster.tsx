import type { CSSProperties } from 'react';
import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Toaster, ToastBar, type Toast, useToasterStore } from 'react-hot-toast';

import { NOTIFICATION_DURATIONS } from './notificationConfig';
import './notifications.css';

export function ToastTimeRemaining({ toast }: { toast: Toast }) {
	if (toast.type === 'loading' || !Number.isFinite(toast.duration)) return null;

	return (
		<span
			className="admin-toast__time-track"
			aria-hidden="true"
		>
			<span
				className="admin-toast__time-remaining"
				style={{ '--toast-duration': `${toast.duration}ms` } as CSSProperties}
			/>
		</span>
	);
}

export function AdminToaster() {
	const toasterLayer = useRef<HTMLDivElement>(null);
	const popoverIsOpen = useRef(false);
	const { toasts } = useToasterStore();

	useLayoutEffect(() => {
		const layer = toasterLayer.current;
		if (!layer) return;

		const hasVisibleToast = toasts.some((toast) => toast.visible && !toast.dismissed);
		if (hasVisibleToast && !popoverIsOpen.current && typeof layer.showPopover === 'function') {
			layer.showPopover();
			popoverIsOpen.current = true;
		} else if (!hasVisibleToast && popoverIsOpen.current && typeof layer.hidePopover === 'function') {
			layer.hidePopover();
			popoverIsOpen.current = false;
		}
	}, [toasts]);

	return createPortal((
		<div ref={toasterLayer} className="admin-toaster-layer" popover="manual">
			<Toaster
				position="top-right"
				reverseOrder={false}
				gutter={10}
				containerClassName="admin-toaster"
				containerStyle={{ zIndex: 1000 }}
				toastOptions={{
					duration: NOTIFICATION_DURATIONS.info,
					className: 'admin-toast',
					success: {
						className: 'admin-toast admin-toast--success',
						duration: NOTIFICATION_DURATIONS.success,
						iconTheme: { primary: '#315244', secondary: '#e7eee9' },
					},
					error: {
						className: 'admin-toast admin-toast--error',
						duration: NOTIFICATION_DURATIONS.error,
						iconTheme: { primary: '#9b493b', secondary: '#f8eae7' },
					},
					loading: {
						className: 'admin-toast admin-toast--loading',
						iconTheme: { primary: '#a98445', secondary: '#f6eddd' },
					},
				}}
			>
				{(toast) => (
					<ToastBar toast={toast}>
						{({ icon, message }) => (
							<>
								{icon}
								{message}
								<ToastTimeRemaining toast={toast} />
							</>
						)}
					</ToastBar>
				)}
			</Toaster>
		</div>
	), document.body);
}
