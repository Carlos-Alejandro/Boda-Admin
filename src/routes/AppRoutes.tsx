import { Route, Routes } from 'react-router-dom';

import { CreateInvitationPage } from '../features/invitations/pages/CreateInvitationPage';
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
					<Route path="invitaciones/nueva" element={<CreateInvitationPage />} />
				</Route>
			</Route>

			<Route path="*" element={<NotFoundPage />} />
		</Routes>
	);
}
