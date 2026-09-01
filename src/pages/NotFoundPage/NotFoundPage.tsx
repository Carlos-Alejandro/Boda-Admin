import { Link } from 'react-router-dom';

export function NotFoundPage() {
	return (
		<main className="grid min-h-screen place-items-center p-[var(--content-padding)]">
			<section className="w-full max-w-md rounded-2xl border border-admin-border bg-surface p-[clamp(1.5rem,4vw,2rem)] shadow-admin">
				<h1 className="mt-1 mb-2.5 font-admin-serif text-[1.75rem] font-medium tracking-[-0.025em]">Página no encontrada</h1>
				<p>La ruta solicitada no existe.</p>
				<Link to="/">Volver al inicio</Link>
			</section>
		</main>
	);
}
