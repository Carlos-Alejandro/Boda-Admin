import { useAuth } from '../../auth/useAuth';
import { Button } from '../../shared/components/Button/Button';
import '../LoginPage/authPages.css';

function ShieldIcon() {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
			<path d="M12 3 19 6v5c0 4.7-2.9 8.1-7 10-4.1-1.9-7-5.3-7-10V6l7-3Z" />
			<path d="M9.5 9.5 14.5 14.5m0-5-5 5" />
		</svg>
	);
}

export function UnauthorizedAccessPage() {
	const { logout, signingOut } = useAuth();

	return (
		<main className="auth-screen">
			<section className="auth-card unauthorized-card" aria-labelledby="unauthorized-title">
				<div className="unauthorized-icon auth-enter auth-delay-1">
					<span><ShieldIcon /></span>
				</div>
				<h1 className="auth-title auth-enter auth-delay-2" id="unauthorized-title">Acceso no autorizado</h1>
				<p className="auth-description unauthorized-description auth-enter auth-delay-3">
					La cuenta con la que iniciaste sesión no tiene permisos para acceder al panel administrativo del evento.
				</p>
				<div className="unauthorized-notice auth-enter auth-delay-4" role="note">
					<ShieldIcon />
					<p>Si consideras que se trata de un error, contacta al administrador del evento</p>
				</div>
				<Button className="auth-button logout-button auth-enter auth-delay-5" type="button" variant="primary" disabled={signingOut} onClick={() => void logout()}>
					{signingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
				</Button>
			</section>
		</main>
	);
}
