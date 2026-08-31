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
		<section>
			<h1>Dashboard</h1>

			<p>Sesión iniciada correctamente.</p>

			{user?.displayName && <p>{user.displayName}</p>}
			{user?.email && <p>{user.email}</p>}

			<hr />

			<h2>Estado de Boda-API</h2>

			{apiError ? <p>{apiError}</p> : <p>{apiStatus}</p>}

			<button type="button" onClick={() => void logout()}>
				Cerrar sesión
			</button>
		</section>
	);
}