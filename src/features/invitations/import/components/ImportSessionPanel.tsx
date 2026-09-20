import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../../shared/components/Button/Button';
import { hasUnconfirmedCreation, retryableFailure, type ImportSession } from '../model/importSession';

export function ImportSessionPanel({ session, busy, storageBlocked, onResume, onRemove }: {
  session: ImportSession; busy: boolean; storageBlocked: boolean; onResume: () => Promise<void>; onRemove: (completedOnly: boolean, expected: ImportSession) => Promise<void>;
}) {
  const [confirmDiscard, setConfirmDiscard] = useState<ImportSession | null>(null);
  const title = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (confirmDiscard) title.current?.focus(); }, [confirmDiscard]);
  const blocked = session.items.some(item => item.status === 'failed' && !retryableFailure(item));
  const created = confirmDiscard?.items.filter(item => item.status === 'created').length ?? 0;
  const uncertain = confirmDiscard?.items.filter(hasUnconfirmedCreation).length ?? 0;
  return <section aria-label="Sesión local de importación" className="mt-4 space-y-3 rounded-xl border border-admin-border bg-surface p-4">
    <h2 className="font-bold">{session.status === 'completed' ? storageBlocked ? 'Resultados pendientes de guardar' : 'Resultados conservados en este navegador' : 'Hay una importación pendiente'}</h2>
    <p className="break-words">Archivo: {session.filename} · {session.items.length} invitaciones</p>
    <p>Inicio: {new Date(session.createdAt).toLocaleString()} · Última actualización: {new Date(session.updatedAt).toLocaleString()}</p>
    <p>Los nombres y resultados se conservan en este navegador/dispositivo hasta finalizar o descartar la sesión. No se guardan credenciales. Continúa con la cuenta y el entorno de la importación original.</p>
    {blocked && <p role="alert">Existe un fallo bloqueante. No se cambiarán sus datos ni claves y no se procesarán filas posteriores. Revisa el resultado antes de descartar.</p>}
    {!confirmDiscard && <div className="flex flex-wrap gap-3">
      {session.status === 'completed' && !storageBlocked
        ? <Button type="button" variant="primary" disabled={busy} onClick={() => { void onRemove(true, session); }}>Finalizar sesión</Button>
        : <Button type="button" variant="primary" disabled={busy || (blocked && !storageBlocked)} onClick={() => { void onResume(); }}>{session.status === 'completed' ? 'Guardar resultados y continuar' : 'Continuar importación'}</Button>}
      <Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirmDiscard(structuredClone(session))}>Descartar sesión</Button>
    </div>}
    {confirmDiscard && <div className="space-y-3">
      <p ref={title} tabIndex={-1} className="font-bold">¿Descartar esta importación?</p>
      {created > 0 && <>
        <p>Ya se crearon {created} de {confirmDiscard.items.length} invitaciones.</p>
        <p>Descartar no eliminará las {created} invitaciones creadas, pero se perderá la información necesaria para reanudar esta importación de forma segura.</p>
      </>}
      {uncertain > 0 && <p>Hay {uncertain} operaciones sin resultado confirmado. Algunas invitaciones podrían haberse creado aunque Boda-Admin todavía no tenga confirmación. Descartar elimina las claves necesarias para reconciliarlas de forma segura.</p>}
      {created === 0 && uncertain === 0 && <p>Todavía no se ha creado ninguna invitación. Se eliminará el progreso guardado de esta importación.</p>}
      {(created > 0 || uncertain > 0) && <p>Volver a importar el mismo archivo podría generar duplicados. Solo se elimina la sesión local; esta acción no elimina ni archiva invitaciones.</p>}
      <Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirmDiscard(null)}>Cancelar</Button>
      <Button type="button" variant="primary" disabled={busy} onClick={() => {
        const expected = confirmDiscard;
        setConfirmDiscard(null);
        void onRemove(false, expected);
      }}>{created > 0 || uncertain > 0 ? 'Descartar de todas formas' : 'Descartar'}</Button>
    </div>}
  </section>;
}
