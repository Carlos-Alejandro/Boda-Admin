import { Link } from 'react-router-dom';
import type { ImportItem } from '../model/importExecution';
import { hasUnconfirmedCreation } from '../model/importSession';

const labels = { pending: 'No procesada', creating: 'Creando', created: 'Creada', failed: 'Fallida', unknown: 'Resultado desconocido' };
export function ImportResults({ items, running, reconciling = false, storageBlocked = false }: { items: ImportItem[]; running: boolean; reconciling?: boolean; storageBlocked?: boolean }) {
  const count = (status: ImportItem['status']) => items.filter(item => item.status === status).length;
  const processed = count('created') + count('failed') + count('unknown');
  const activeIndex = items.findIndex(item => item.status === 'creating');
  return <section aria-label="Resultado de importación" className="mt-5 space-y-3 rounded-xl border border-admin-border bg-surface p-4">
    <div role="status" aria-live="polite">
      <h2 className="font-bold">{running ? activeIndex < 0 ? 'Actualizando sesión local…' : reconciling ? 'Reconciliando resultado con la misma clave…' : `Creando invitación ${activeIndex + 1} de ${items.length}` : storageBlocked ? 'Importación detenida: comprueba la sesión local' : count('created') === items.length ? 'Importación completada' : 'Importación detenida'}</h2>
      <p>{processed} / {items.length} procesadas</p>
      <p>{count('created')} creadas · {count('failed')} fallidas · {count('pending')} no procesadas · {count('unknown')} desconocidas</p>
    </div>
    {!running && <p>Las invitaciones creadas se conservan. No hay rollback ni reintentos automáticos. Continúa esta sesión para reconciliar resultados desconocidos y procesar las pendientes con sus claves originales.</p>}
    {storageBlocked && <p role="alert">No es seguro recargar ni iniciar otra importación mientras no se resuelva el error local. Los resultados visibles pueden estar solo en memoria.</p>}
    {items.some(hasUnconfirmedCreation) && <p role="alert">Un resultado sin confirmar puede corresponder a una invitación ya creada, incluso si su reconciliación falló. Conserva la sesión; no vuelvas a importar esa fila con una clave nueva.</p>}
    <ul className="space-y-3">
      {items.map(item => <li key={item.row} className="break-words">
        <p>Fila {item.row}: {item.displayName} — {labels[item.status]}</p>
        {item.status === 'created' && item.invitationId && <p>ID: {item.invitationId} · <Link className="underline" to={`/invitaciones/${encodeURIComponent(item.invitationId)}`}>Ver invitación</Link></p>}
        {item.error && <p>{item.error}</p>}
      </li>)}
    </ul>
  </section>;
}
