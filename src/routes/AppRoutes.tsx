import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import { CreateInvitationPage } from '../features/invitations/pages/CreateInvitationPage';
import { InvitationListPage } from '../features/invitations/pages/InvitationListPage';
import { InvitationDetailPage } from '../features/invitations/pages/InvitationDetailPage';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage';
import { AdminLayout } from '../layouts/AdminLayout/AdminLayout';
import { LoginPage } from '../pages/LoginPage/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage/NotFoundPage';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicOnlyRoute } from './PublicOnlyRoute';

const ImportInvitationsPage = lazy(() => import('../features/invitations/pages/ImportInvitationsPage').then((module) => ({ default: module.ImportInvitationsPage })));

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
					<Route path="invitaciones/importar" element={<Suspense fallback={<p role="status">Cargando importador…</p>}><ImportInvitationsPage /></Suspense>} />
					<Route path="invitaciones/:id" element={<InvitationDetailPage />} />
				</Route>
			</Route>

			<Route path="*" element={<NotFoundPage />} />
		</Routes>
	);
}
