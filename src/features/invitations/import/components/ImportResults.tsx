import { Link } from 'react-router-dom';
import type { ImportItem } from '../model/importExecution';

const labels = { pending: 'No procesada', creating: 'Creando', created: 'Creada', failed: 'Fallida', unknown: 'Resultado desconocido' };
export function ImportResults({ items, running }: { items: ImportItem[]; running: boolean }) {
  const count = (status: ImportItem['status']) => items.filter(item => item.status === status).length;
  const processed = count('created') + count('failed') + count('unknown');
  return <section aria-label="Resultado de importación" className="mt-5 space-y-3 rounded-xl border border-admin-border bg-surface p-4">
    <div role="status" aria-live="polite">
      <h2 className="font-bold">{running ? `Creando invitación ${Math.min(processed + 1, items.length)} de ${items.length}` : count('created') === items.length ? 'Importación completada' : 'Importación detenida'}</h2>
      <p>{processed} / {items.length} procesadas</p>
      <p>{count('created')} creadas · {count('failed')} fallidas · {count('pending')} no procesadas · {count('unknown')} desconocidas</p>
    </div>
    {!running && <p>Las invitaciones creadas se conservan. No hay rollback ni reintentos en esta etapa. Los resultados se perderán al salir o recargar.</p>}
    {count('unknown') > 0 && <p role="alert">Un resultado desconocido puede corresponder a una invitación ya creada. No vuelvas a importar esa fila manualmente con una clave nueva.</p>}
    <ul className="space-y-3">
      {items.map(item => <li key={item.row} className="break-words">
        <p>Fila {item.row}: {item.displayName} — {labels[item.status]}</p>
        {item.status === 'created' && item.invitationId && <p>ID: {item.invitationId} · <Link className="underline" to={`/invitaciones/${encodeURIComponent(item.invitationId)}`}>Ver invitación</Link></p>}
        {item.error && <p>{item.error}</p>}
      </li>)}
    </ul>
  </section>;
}
