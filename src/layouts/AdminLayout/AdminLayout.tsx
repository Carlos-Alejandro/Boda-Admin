import { Outlet } from 'react-router-dom';

import { AdminSidebar } from '../../shared/components/AdminSidebar/AdminSidebar';

export function AdminLayout() {
	return (
		<div className="grid min-h-screen min-h-dvh grid-cols-[var(--sidebar-width)_minmax(0,1fr)] max-[56.25rem]:grid-cols-1 max-[56.25rem]:grid-rows-[auto_1fr]">
			<AdminSidebar />
			<main className="mx-auto w-full min-w-0 max-w-[var(--page-max-width)] px-[var(--content-padding)] pt-[clamp(1.35rem,2.4vw,2.75rem)] pb-12">
				<Outlet />
			</main>
		</div>
	);
}
