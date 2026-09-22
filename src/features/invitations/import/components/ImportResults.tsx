import { Link } from 'react-router-dom';
import type { ImportItem } from '../model/importExecution';
import { hasUnconfirmedCreation, retryableFailure } from '../model/importSession';

const labels = { pending: 'No procesada', creating: 'Creando', created: 'Creada', failed: 'Fallida', unknown: 'Resultado desconocido' };
export function ImportResults({ items, running, reconciling = false, storageBlocked = false }: { items: ImportItem[]; running: boolean; reconciling?: boolean; storageBlocked?: boolean }) {
  const count = (status: ImportItem['status']) => items.filter(item => item.status === status).length;
  const completed = count('created') === items.length;
  const blocked = items.some(item => item.status === 'failed' && !retryableFailure(item));
  const processed = count('created') + count('failed') + count('unknown');
  const activeIndex = items.findIndex(item => item.status === 'creating');
  return <section aria-label="Resultado de importación" className="mt-5 space-y-3 rounded-xl border border-admin-border bg-surface p-4">
    <div role="status" aria-live="polite" aria-atomic="true">
      <h2 className="font-bold">{running ? activeIndex < 0 ? 'Actualizando sesión local…' : reconciling ? 'Reconciliando resultado con la misma clave…' : `Creando invitación ${activeIndex + 1} de ${items.length}` : storageBlocked ? 'Importación detenida: comprueba la sesión local' : completed ? 'Importación completada' : 'Importación detenida'}</h2>
      <p>{processed} / {items.length} procesadas</p>
      <p>{count('created')} creadas · {count('failed')} fallidas · {count('pending')} no procesadas · {count('unknown')} desconocidas</p>
    </div>
    <progress aria-label="Progreso de importación" max={items.length} value={processed} aria-valuetext={`${processed} de ${items.length} procesadas; ${count('created')} creadas, ${count('failed')} fallidas, ${count('unknown')} desconocidas`} />
    {!running && <p>{completed
      ? storageBlocked ? 'Todas las invitaciones están creadas. Guarda los resultados locales antes de finalizar; no se volverán a enviar.' : 'Todas las invitaciones están creadas. Puedes revisar sus detalles, volver al listado o finalizar la sesión local.'
      : blocked ? 'La importación no puede continuar por un fallo bloqueante. Revisa el error y las invitaciones creadas antes de decidir si descartas la sesión local.'
      : 'Las invitaciones creadas se conservan. No hay reintentos automáticos. Continúa esta sesión para reconciliar resultados desconocidos y procesar las pendientes con sus claves originales. Si hubo un rechazo por acceso o demasiadas solicitudes, resuelve la causa antes de continuar.'}</p>}
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
