import { useEffect, useState } from 'react';

import { useAuth } from '../../auth/useAuth';
import { getAdminHealth } from '../../services/adminHealth/service';

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
		<section className="dashboard-page">
			<header className="page-heading">
				<p className="section-eyebrow">Panel administrativo</p>
				<h1>Dashboard</h1>
				<p>Consulta el estado general de tu sesión y los servicios conectados.</p>
			</header>

			<div className="dashboard-grid">
				<article className="dashboard-card">
					<p className="card-kicker">Cuenta</p>
					<h2>Sesión activa</h2>
					<p className="status-line">
						<span className="status-dot" aria-hidden="true" />
						Sesión iniciada correctamente
					</p>
					{user?.displayName && <strong>{user.displayName}</strong>}
					{user?.email && <p className="muted-text">{user.email}</p>}
				</article>

				<article className="dashboard-card">
					<p className="card-kicker">Conectividad</p>
					<h2>Estado de Boda-API</h2>
					{apiError ? (
						<p className="error-message">{apiError}</p>
					) : (
						<p className="muted-text">{apiStatus}</p>
					)}
				</article>
			</div>

			<button className="secondary-button" type="button" onClick={() => void logout()}>
				Cerrar sesión
			</button>
		</section>
	);
}
