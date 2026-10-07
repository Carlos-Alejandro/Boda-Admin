import { Button } from '../../../shared/components/Button/Button';
import { DashboardSummary } from '../components/DashboardSummary';
import { useDashboardMetrics } from '../model/useDashboardMetrics';

import '../components/Dashboard.css';

export function DashboardPage() {
	const { state, retry } = useDashboardMetrics();

	return (
		<section
			className="dashboard-page w-full min-w-0"
			aria-labelledby="dashboard-title"
		>
			<header className="dashboard-hero">
				<div className="dashboard-hero__intro">
					<p className="dashboard-hero__eyebrow">
						¡Hola!
					</p>

					<h1
						id="dashboard-title"
						className="dashboard-hero__title"
					>
						Resumen de tu boda
					</h1>

					<p className="dashboard-hero__description">
						Aquí puedes ver el estado general de tus invitaciones y
						confirmaciones.
					</p>
				</div>

                <div className="dashboard-hero__aside">
                    {state.status === 'success' && (
                        <div className="dashboard-hero__date">
                            <time dateTime={state.consultedAt}>
                                <span>
                                    {new Intl.DateTimeFormat('es-MX', {
                                        weekday: 'long',
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                        timeZone: 'America/Cancun',
                                    }).format(new Date(state.consultedAt))}
                                </span>

                                <strong>
                                    {new Intl.DateTimeFormat('es-MX', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true,
                                        timeZone: 'America/Cancun',
                                    }).format(new Date(state.consultedAt))}
                                </strong>
                            </time>

                            <span className="visually-hidden">
                                . Los datos se actualizan al volver a esta página.
                            </span>
                        </div>
                    )}

                    <div
                        className="dashboard-hero__decoration"
                        aria-hidden="true"
                    >
                        <span className="dashboard-hero__heart">♥</span>

                        <div className="dashboard-hero__phrase">
                            <span>Grandes momentos</span>

                            <strong>
                                comienzan con personas especiales
                            </strong>
                        </div>
                    </div>
                </div>
			</header>

			{state.status === 'loading' && (
				<div role="status" aria-live="polite" className="dashboard-loading">
					<span className="visually-hidden">Cargando resumen de la boda...</span>
					<div className="dashboard-loading__cards" aria-hidden="true">
						{Array.from({ length: 4 }, (_, index) => (
							<div className="dashboard-loading__card" key={index}>
								<span /><span /><span />
							</div>
						))}
					</div>
				</div>
			)}

			{state.status === 'error' && (
				<div
					role="alert"
					className="dashboard-error"
				>
					<p className="mt-0 mb-3 text-admin-danger">
						No fue posible cargar el resumen de la boda.
					</p>

					<Button
						variant="secondary"
						type="button"
						onClick={retry}
					>
						Reintentar
					</Button>
				</div>
			)}

			{state.status === 'success' && (
				<DashboardSummary
					metrics={state.metrics}
					details={state.details}
				/>
			)}
		</section>
	);
}
