import { Outlet } from 'react-router-dom';

import { AdminHeader } from '../../shared/components/AdminHeader/AdminHeader';
import { AdminSidebar } from '../../shared/components/AdminSidebar/AdminSidebar';

export function AdminLayout() {
	return (
		<div className="grid min-h-screen grid-cols-[15rem_minmax(0,1fr)] max-[64rem]:grid-cols-[13rem_minmax(0,1fr)] max-md:grid-cols-1">
			<AdminSidebar />
			<div className="min-w-0">
				<AdminHeader />
				<main className="mx-auto w-full max-w-[var(--page-max-width)] px-[var(--content-padding)] pt-[clamp(1.35rem,2.4vw,2rem)] pb-12">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
