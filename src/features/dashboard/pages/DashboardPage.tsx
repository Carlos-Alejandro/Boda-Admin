import { useEffect, useState } from 'react';

import { useAuth } from '../../../auth/useAuth';
import { Button } from '../../../shared/components/Button/Button';
import { PageHeader } from '../../../shared/components/PageHeader/PageHeader';
import { getAdminHealth } from '../api/dashboardService';

export function DashboardPage() {
	const { user, logout } = useAuth();

	const [apiStatus, setApiStatus] = useState('Conectando con Boda-API...');
	const [apiError, setApiError] = useState('');

	useEffect(() => {
		const checkApi = async () => {
			try {
				const response = await getAdminHealth();

				setApiStatus(
					response.authenticated
						? 'Boda-API conectada y autenticada correctamente.'
						: 'La API respondió, pero la sesión no fue autenticada.',
				);
			} catch (error) {
				console.error('Error al conectar con Boda-API:', error);
				setApiError('No fue posible conectar con Boda-API.');
			}
		};

		void checkApi();
	}, []);

	return (
		<section className="w-full text-[0.9rem] max-md:text-[0.9375rem]">
			<PageHeader
				eyebrow="Panel administrativo"
				title="Dashboard"
				description="Consulta el estado general de tu sesión y los servicios conectados."
			/>

			<div className="my-6 grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
				<article className="min-h-[10.5rem] rounded-[0.8rem] border border-admin-border bg-surface p-5 shadow-[0_0.5rem_1.75rem_rgba(34,54,45,0.045)] [&>p]:mb-1.5 [&>strong]:mb-1.5 [&>strong]:block">
					<p className="m-0 text-admin-eyebrow font-extrabold tracking-[0.12em] text-[#927039] uppercase">Cuenta</p>
					<h2 className="mt-1 mb-3 font-admin-serif text-[1.15rem] font-medium">Sesión activa</h2>
					<p className="flex items-center gap-2 text-admin-green-700">
						<span className="h-[0.55rem] w-[0.55rem] rounded-full bg-[#4f8069] shadow-[0_0_0_3px_#e7eee9]" aria-hidden="true" />
						Sesión iniciada correctamente
					</p>
					{user?.displayName && <strong>{user.displayName}</strong>}
					{user?.email && <p className="leading-relaxed text-admin-muted">{user.email}</p>}
				</article>

				<article className="min-h-[10.5rem] rounded-[0.8rem] border border-admin-border bg-surface p-5 shadow-[0_0.5rem_1.75rem_rgba(34,54,45,0.045)] [&>p]:mb-1.5">
					<p className="m-0 text-admin-eyebrow font-extrabold tracking-[0.12em] text-[#927039] uppercase">Conectividad</p>
					<h2 className="mt-1 mb-3 font-admin-serif text-[1.15rem] font-medium">Estado de Boda-API</h2>
					{apiError ? (
						<p className="text-admin-danger">{apiError}</p>
					) : (
						<p className="leading-relaxed text-admin-muted">{apiStatus}</p>
					)}
				</article>
			</div>

			<Button variant="secondary" type="button" onClick={() => void logout()}>
				Cerrar sesión
			</Button>
		</section>
	);
}
