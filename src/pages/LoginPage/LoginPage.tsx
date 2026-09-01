import { useState } from 'react';

import { getSafeAuthErrorCode } from '../../auth/authService';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../shared/components/Button/Button';

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
		<main className="grid min-h-screen place-items-center p-[var(--content-padding)]">
			<section className="w-full max-w-md rounded-2xl border border-admin-border bg-surface p-[clamp(1.5rem,4vw,2rem)] text-[0.9rem] shadow-admin" aria-labelledby="login-title">
				<p className="m-0 text-admin-eyebrow font-extrabold tracking-[0.12em] text-[#927039] uppercase">Panel administrativo</p>
				<h1 className="mt-1 mb-2.5 font-admin-serif text-[1.75rem] font-medium tracking-[-0.025em]" id="login-title">Boda Admin</h1>
				<p className="mt-0 mb-5 leading-[1.55] text-admin-muted">Inicia sesión para acceder al área administrativa.</p>

				<Button className="w-full" variant="primary" type="button" disabled={submitting} onClick={handleLogin}>
					{submitting ? 'Iniciando sesión...' : 'Iniciar sesión con Google'}
				</Button>

				{error && (
					<p className="text-admin-danger" role="alert">
						{error}
					</p>
				)}
			</section>
		</main>
	);
}
