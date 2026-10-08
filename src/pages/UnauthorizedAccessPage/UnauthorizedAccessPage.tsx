import { useAuth } from '../../auth/useAuth';
import { Button } from '../../shared/components/Button/Button';

export function UnauthorizedAccessPage() {
	const { logout, signingOut } = useAuth();

	return (
		<main className="grid min-h-screen min-h-dvh place-items-center p-[var(--content-padding)]">
			<section className="w-full max-w-md rounded-2xl border border-admin-border bg-surface p-[clamp(1.5rem,4vw,2rem)] text-center text-[0.9rem] shadow-admin" aria-labelledby="unauthorized-title">
				<div className="mx-auto mb-5 grid size-12 place-items-center rounded-full bg-admin-green-100 text-admin-green-700" aria-hidden="true">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-6">
						<path d="M12 3 19 6v5c0 4.7-2.9 8.1-7 10-4.1-1.9-7-5.3-7-10V6l7-3Z" />
						<path d="m9 12 2 2 4-4" />
					</svg>
				</div>
				<h1 id="unauthorized-title" className="m-0 font-admin-serif text-2xl font-medium">Acceso no autorizado</h1>
				<p className="my-4 text-admin-muted">Tu cuenta no tiene permisos para acceder a este panel. Contacta al administrador si consideras que se trata de un error</p>
				<Button type="button" variant="primary" disabled={signingOut} onClick={() => void logout()}>
					{signingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
				</Button>
			</section>
		</main>
	);
}
