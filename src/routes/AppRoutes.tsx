import { Route, Routes } from 'react-router-dom';

import { InvitationListPage } from '../features/invitations/pages/InvitationListPage';
import { AdminLayout } from '../layouts/AdminLayout';
import { DashboardPage } from '../pages/DashboardPage/DashboardPage';
import { LoginPage } from '../pages/LoginPage/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage/NotFoundPage';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicOnlyRoute } from './PublicOnlyRoute';

export function AppRoutes() {
	return (
		<Routes>
			<Route element={<PublicOnlyRoute />}>
				<Route path="/login" element={<LoginPage />} />
			</Route>

			<Route element={<ProtectedRoute />}>
				<Route element={<AdminLayout />}>
					<Route index element={<DashboardPage />} />
					<Route path="invitaciones" element={<InvitationListPage />} />
				</Route>
			</Route>

			<Route path="*" element={<NotFoundPage />} />
		</Routes>
	);
}
