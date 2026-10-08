import { useState } from 'react';

import { getSafeAuthErrorCode } from '../../auth/authService';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../shared/components/Button/Button';
import './authPages.css';

const benefits = [
	'Revisa y administra todas las invitaciones.',
	'Consulta confirmaciones en tiempo real.',
	'Gestiona la información de forma segura.',
];

function CheckIcon() {
	return (
		<svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
			<path d="m5.5 10.2 2.8 2.7 6.2-6.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function GoogleIcon() {
	return (
		<svg viewBox="0 0 48 48" aria-hidden="true">
			<path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z" />
			<path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z" />
			<path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z" />
			<path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.9 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3C14.2 15.6 18.7 12 24 12Z" />
		</svg>
	);
}

function LockIcon() {
	return (
		<svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
			<rect x="4.5" y="8.5" width="11" height="8" rx="1.8" stroke="currentColor" strokeWidth="1.4" />
			<path d="M7 8.5V6a3 3 0 0 1 6 0v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
		</svg>
	);
}

function ArrowIcon() {
	return (
		<svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
			<path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

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
			console.error('No fue posible iniciar sesión con Google:', getSafeAuthErrorCode(loginError));
			setError('No fue posible iniciar sesión con Google. Inténtalo de nuevo.');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<main className="auth-screen">
			<section className="auth-card login-card" aria-labelledby="login-title">
				<p className="auth-eyebrow auth-enter auth-delay-1">Panel administrativo</p>
				<h1 className="auth-title auth-enter auth-delay-2" id="login-title">Boda Admin</h1>
				<p className="auth-description auth-enter auth-delay-3">
					Inicia sesión para acceder al panel y gestionar las invitaciones de tu boda
				</p>

				<div className="auth-divider auth-enter auth-delay-4" aria-hidden="true">
					<span />
					<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 17.2 3.6 11a4.1 4.1 0 0 1 5.8-5.8l.6.6.6-.6a4.1 4.1 0 0 1 5.8 5.8L10 17.2Z" /></svg>
					<span />
				</div>

				<ul className="auth-benefits" aria-label="Beneficios del panel">
					{benefits.map((benefit, index) => (
						<li className={`auth-enter auth-delay-${index + 5}`} key={benefit}>
							<span className="auth-benefit-icon"><CheckIcon /></span>
							<span>{benefit}</span>
						</li>
					))}
				</ul>

				<Button className="auth-button login-button auth-enter auth-delay-8" variant="primary" type="button" disabled={submitting} onClick={handleLogin}>
					<GoogleIcon />
					<span>{submitting ? 'Iniciando sesión...' : 'Iniciar sesión con Google'}</span>
					<ArrowIcon />
				</Button>

				{error && <p className="auth-error auth-enter" role="alert">{error}</p>}

				<p className="auth-privacy auth-enter auth-delay-9">
					<LockIcon />
					<span>Solo personas autorizadas pueden acceder a este panel</span>
				</p>
			</section>
		</main>
	);
}
