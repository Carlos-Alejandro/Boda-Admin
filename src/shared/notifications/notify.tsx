import toast, { type ToastOptions } from 'react-hot-toast';

import { NOTIFICATION_DURATIONS } from './notificationConfig';

interface NotificationOptions extends ToastOptions {
	description?: string;
}

function content(title: string, description?: string) {
	return (
		<div className="admin-toast__content">
			<strong>{title}</strong>
			{description && <span>{description}</span>}
		</div>
	);
}

function options({ description: _description, ...toastOptions }: NotificationOptions) {
	return toastOptions;
}

export const notify = {
	success(title: string, notificationOptions: NotificationOptions = {}) {
		return toast.success(content(title, notificationOptions.description), {
			duration: NOTIFICATION_DURATIONS.success,
			ariaProps: { role: 'status', 'aria-live': 'polite' },
			...options(notificationOptions),
		});
	},
	error(title: string, notificationOptions: NotificationOptions = {}) {
		return toast.error(content(title, notificationOptions.description), {
			duration: NOTIFICATION_DURATIONS.error,
			ariaProps: { role: 'alert', 'aria-live': 'assertive' },
			...options(notificationOptions),
		});
	},
	warning(title: string, notificationOptions: NotificationOptions = {}) {
		return toast(content(title, notificationOptions.description), {
			duration: NOTIFICATION_DURATIONS.warning,
			className: 'admin-toast admin-toast--warning',
			icon: <span className="admin-toast__symbol" aria-hidden="true">!</span>,
			ariaProps: { role: 'status', 'aria-live': 'polite' },
			...options(notificationOptions),
		});
	},
	info(title: string, notificationOptions: NotificationOptions = {}) {
		return toast(content(title, notificationOptions.description), {
			duration: NOTIFICATION_DURATIONS.info,
			className: 'admin-toast admin-toast--info',
			icon: <span className="admin-toast__symbol" aria-hidden="true">i</span>,
			ariaProps: { role: 'status', 'aria-live': 'polite' },
			...options(notificationOptions),
		});
	},
	loading(title: string, notificationOptions: NotificationOptions = {}) {
		return toast.loading(content(title, notificationOptions.description), {
			ariaProps: { role: 'status', 'aria-live': 'polite' },
			...options(notificationOptions),
		});
	},
	dismiss(id?: string) {
		toast.dismiss(id);
	},
};
