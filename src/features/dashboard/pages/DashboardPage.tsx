import { Button } from '../../../shared/components/Button/Button';
import { PageHeader } from '../../../shared/components/PageHeader/PageHeader';
import { DashboardSummary } from '../components/DashboardSummary';
import { useDashboardMetrics } from '../model/useDashboardMetrics';

export function DashboardPage() {
 const { state, retry } = useDashboardMetrics();
 return (
  <section className="w-full text-[0.9rem] max-md:text-[0.9375rem]" aria-labelledby="dashboard-title">
   <PageHeader eyebrow="Panel administrativo" title="Dashboard" titleId="dashboard-title" description="Resumen general de la boda" />
   {state.status === 'loading' && (
    <p role="status" className="mt-5 rounded-xl border border-dashed border-admin-border px-4 py-8 text-center text-admin-muted">Cargando resumen de la boda...</p>
   )}
   {state.status === 'error' && (
    <div role="alert" className="mt-5 rounded-xl border border-admin-border bg-surface p-5">
     <p className="mt-0 mb-3 text-admin-danger">No fue posible cargar el resumen de la boda.</p>
     <Button variant="secondary" type="button" onClick={retry}>Reintentar</Button>
    </div>
   )}
   {state.status === 'success' && <DashboardSummary metrics={state.metrics} />}
  </section>
 );
}
