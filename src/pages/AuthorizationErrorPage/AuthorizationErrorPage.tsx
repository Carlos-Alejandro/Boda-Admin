import { useAuth } from '../../auth/useAuth';
import { Button } from '../../shared/components/Button/Button';

export function AuthorizationErrorPage({ onRetry }: { onRetry: () => void }) {
	const { logout, signingOut } = useAuth();

	return (
		<main className="grid min-h-screen min-h-dvh place-items-center p-[var(--content-padding)]">
			<section className="w-full max-w-md rounded-2xl border border-admin-border bg-surface p-[clamp(1.5rem,4vw,2rem)] text-center text-[0.9rem] shadow-admin" aria-labelledby="authorization-error-title">
				<h1 id="authorization-error-title" className="m-0 font-admin-serif text-2xl font-medium">No pudimos comprobar el acceso</h1>
				<p className="my-4 text-admin-muted">Comprueba tu conexión e inténtalo de nuevo.</p>
				<div className="flex flex-wrap justify-center gap-3">
					<Button type="button" variant="primary" onClick={onRetry}>Reintentar</Button>
					<Button type="button" variant="secondary" disabled={signingOut} onClick={() => void logout()}>
						{signingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
					</Button>
				</div>
			</section>
		</main>
	);
}
