import { useEffect, useRef } from 'react';
import { Button, ButtonLink } from '../../../shared/components/Button/Button';
import { PageHeader } from '../../../shared/components/PageHeader/PageHeader';
import { ImportPreview } from '../import/components/ImportPreview';
import { useImportPreview } from '../import/model/useImportPreview';
import { useImportExecution } from '../import/model/useImportExecution';
import { ImportResults } from '../import/components/ImportResults';
import { ImportSessionPanel } from '../import/components/ImportSessionPanel';

export function ImportInvitationsPage() {
  const { state, selectFile } = useImportPreview();
  const analysis = state.status === 'valid' || state.status === 'invalid' ? state.analysis : null;
  const execution = useImportExecution(analysis, state.status === 'empty' ? '' : state.filename);
  const confirmation = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (execution.phase === 'confirming') confirmation.current?.focus();
  }, [execution.phase]);
  return <section aria-labelledby="import-title" className="w-full text-sm">
    <PageHeader title="Importar invitaciones" titleId="import-title" eyebrow="Gestión de invitaciones" description="Revisa tu Excel localmente y confirma la creación de las invitaciones." />
    <div className="mt-5 space-y-4 rounded-xl border border-admin-border bg-surface p-4">
      <a className="inline-block font-semibold underline" href={`${import.meta.env.BASE_URL}templates/plantilla-invitaciones-v1.xlsx`} download="plantilla-invitaciones-v1.xlsx">Descargar plantilla XLSX</a>
      <p>Completa únicamente la hoja Invitaciones: una invitación por fila y una persona por columna, desde Invitado 1, sin huecos. Puedes agregar más columnas Invitado N consecutivamente. No escribas códigos ni IDs; el sistema generará los IDs al crear las invitaciones. Usa valores, no fórmulas.</p>
      <label className="block font-semibold" htmlFor="import-file">Seleccionar archivo XLSX</label>
      <input id="import-file" type="file" disabled={execution.fileBlocked} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="block w-full min-w-0" onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file && execution.reset()) void selectFile(file);
      }} />
      <p className="text-admin-muted">El XLSX se procesa localmente y no se guarda ni se sube. Al confirmar se guardan los datos normalizados y las claves en este navegador antes de enviarlos a Boda-API. Una sesión existente debe continuarse, finalizarse o descartarse explícitamente antes de seleccionar otro Excel.</p>
    </div>
    <div className="mt-4" role="status" aria-live="polite">
      {execution.previewConsumed && !execution.session && execution.phase === 'idle' && <p>Selecciona un archivo nuevo para comenzar otra importación. Volver a importar el mismo Excel puede crear duplicados.</p>}
      {!execution.previewConsumed && !execution.session && <>
      {state.status === 'empty' && <p>Selecciona un archivo para comenzar.</p>}
      {state.status !== 'empty' && <p className="break-words">Archivo: {state.filename}</p>}
      {state.status === 'reading' && <p>Leyendo y validando todo el archivo…</p>}
      {state.status === 'valid' && <p>Archivo válido. Revisa la vista previa y las posibles advertencias.</p>}
      {state.status === 'invalid' && <p className="text-admin-danger">Archivo con errores. Corrige las celdas indicadas y vuelve a seleccionarlo.</p>}
      {state.status === 'read-error' && <p className="text-admin-danger">{state.message}</p>}
      </>}
    </div>
    {execution.phase === 'loading' && <p role="status">Comprobando sesión local…</p>}
    {execution.session && <ImportSessionPanel key={execution.session.id} session={execution.session} recovered={execution.recovered} busy={execution.phase === 'running' || execution.phase === 'loading'} storageBlocked={execution.storageBlocked} onResume={execution.resume} onRemove={execution.remove} />}
    {(state.status === 'valid' || state.status === 'invalid') && !execution.session && !execution.previewConsumed && <ImportPreview analysis={state.analysis} />}
    <div className="mt-6 space-y-3">
      <Button id="start-import" type="button" variant="primary" disabled={!execution.eligible} onClick={execution.open}>Importar invitaciones</Button>
      {execution.phase === 'confirming' && analysis && <div ref={confirmation} tabIndex={-1} role="region" aria-label="Confirmar importación" className="space-y-3 rounded-xl border border-admin-border p-4">
        <p>Se crearán {analysis.invitations.length} invitaciones con {analysis.summary.totalSlots} cupos en total.</p>
        <p>Se guardará una sesión local para recuperar esta importación si se interrumpe. Si ocurre un fallo, se detendrá y las invitaciones ya creadas se conservarán. No borres los datos de este navegador.</p>
        <Button type="button" variant="secondary" onClick={() => { execution.cancel(); requestAnimationFrame(() => document.getElementById('start-import')?.focus()); }}>Cancelar</Button>
        <Button type="button" variant="primary" onClick={() => { void execution.confirm(); }}>Crear invitaciones</Button>
      </div>}
      {execution.error && <p role="alert">{execution.error}</p>}
      <Button type="button" variant="secondary" disabled={execution.phase === 'running' || execution.phase === 'loading' || execution.phase === 'confirming'} onClick={() => { void execution.refresh(); }}>Comprobar sesión local</Button>
      {execution.items.length > 0 && <ImportResults items={execution.items} running={execution.phase === 'running'} reconciling={execution.reconciling} storageBlocked={execution.storageBlocked} />}
      <ButtonLink variant="text" to="/invitaciones">Volver a invitaciones</ButtonLink>
    </div>
  </section>;
}
