import { useState } from 'react';

import { getSafeAuthErrorCode } from '../../auth/authService';
import { useAuth } from '../../auth/useAuth';

export function LoginPage() {
	const { login } = useAuth();
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState('');

	const handleLogin = async () => {
		try {
			setError('');
			setSubmitting(true);
			await login();
		} catch (loginError) {
			console.error(
				'No fue posible iniciar sesión con Google:',
				getSafeAuthErrorCode(loginError),
			);
			setError('No fue posible iniciar sesión con Google. Inténtalo de nuevo.');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<main className="centered-page">
			<section className="card" aria-labelledby="login-title">
				<h1 id="login-title">Boda Admin</h1>
				<p>Inicia sesión para acceder al área administrativa.</p>

				<button type="button" disabled={submitting} onClick={handleLogin}>
					{submitting ? 'Iniciando sesión...' : 'Iniciar sesión con Google'}
				</button>

				{error && (
					<p className="error-message" role="alert">
						{error}
					</p>
				)}
			</section>
		</main>
	);
}
