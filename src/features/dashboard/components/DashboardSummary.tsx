import type { DashboardMetrics } from '../model/calculateDashboardMetrics';

interface SummaryItem {
 label: string;
 value: number;
}
const formatNumber = (value: number) => value.toLocaleString('es-MX');

function SummarySection({ title, items }: { title: string; items: SummaryItem[] }) {
 return (
  <section className="rounded-xl border border-admin-border bg-surface p-4">
   <h2 className="mt-0 mb-2 font-admin-serif text-lg font-medium">{title}</h2>
   <dl className="m-0 divide-y divide-admin-border">
    {items.map(({ label, value }) => (
     <div key={label} className="flex items-center justify-between gap-4 py-2">
      <dt className="text-admin-muted">{label}</dt>
      <dd className="m-0 font-semibold tabular-nums">{formatNumber(value)}</dd>
     </div>
    ))}
   </dl>
  </section>
 );
}

export function DashboardSummary({ metrics }: { metrics: DashboardMetrics }) {
 const cards: SummaryItem[] = [
  { label: 'Cupos actuales', value: metrics.currentSlots },
  { label: 'Asisten', value: metrics.attending },
  { label: 'Sin respuesta', value: metrics.unanswered },
 ];
 return (
  <div className="mt-5">
   {metrics.registeredInvitations === 0 && (
    <p role="status" className="mb-4 rounded-lg border border-admin-border bg-surface-soft p-3 text-admin-muted">No hay invitaciones registradas. El resumen muestra los valores actuales en cero.</p>
   )}
   <p className="mt-0 mb-3 text-[0.8rem] text-admin-muted">Las cifras de la boda incluyen únicamente invitaciones activas.</p>
   <dl className="m-0 grid grid-cols-1 gap-3 min-[48rem]:grid-cols-3">
    {cards.map(({ label, value }, index) => (
     <div key={label} className="rounded-xl border border-admin-border border-t-2 border-t-admin-gold bg-surface p-4">
      <dt className="text-[0.82rem] font-semibold">{label}</dt>
      <dd className="mx-0 mt-1 mb-0 text-[1.75rem] leading-tight font-semibold tabular-nums">{formatNumber(value)}</dd>
      {index === 0 && (
       <dd className="mx-0 mt-3 mb-0 border-t border-admin-border pt-2 text-[0.8rem] leading-relaxed text-admin-muted">
        <span className="block"><span className="font-semibold tabular-nums">{formatNumber(metrics.identifiedPeople)}</span> personas identificadas</span>
        <span className="block"><span className="font-semibold tabular-nums">{formatNumber(metrics.unassignedSpaces)}</span> espacios sin asignar</span>
       </dd>
      )}
     </div>
    ))}
   </dl>
   <dl className="mx-0 mt-3 mb-0 flex flex-wrap gap-x-6 gap-y-2 px-1 text-[0.8rem] text-admin-muted">
    {[
     { label: 'No asisten', value: metrics.notAttending },
     { label: 'Reemplazos actuales', value: metrics.currentReplacements },
    ].map(({ label, value }) => (
     <div key={label} className="flex items-baseline gap-2">
      <dt>{label}:</dt>
      <dd className="m-0 font-semibold text-admin-green-900 tabular-nums">{formatNumber(value)}</dd>
     </div>
    ))}
   </dl>
   <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
    <SummarySection title="Invitaciones" items={[
     { label: 'Invitaciones registradas', value: metrics.registeredInvitations },
     { label: 'Activas', value: metrics.activeInvitations },
     { label: 'Archivadas', value: metrics.archivedInvitations },
    ]} />
    <SummarySection title="Confirmaciones" items={[
     { label: 'Pendientes', value: metrics.rsvp.pending },
     { label: 'Parciales', value: metrics.rsvp.partial },
     { label: 'Confirmadas', value: metrics.rsvp.confirmed },
     { label: 'Declinadas', value: metrics.rsvp.declined },
    ]} />
   </div>
  </div>
 );
}
