import { useEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import excelIllustration from '../../../assets/import/excel-import.png';
import { Button, ButtonLink } from '../../../shared/components/Button/Button';
import { PageHeader } from '../../../shared/components/PageHeader/PageHeader';
import { ImportPreview } from '../import/components/ImportPreview';
import { useImportPreview } from '../import/model/useImportPreview';
import { useImportExecution } from '../import/model/useImportExecution';
import { ImportResults } from '../import/components/ImportResults';
import { ImportSessionPanel } from '../import/components/ImportSessionPanel';
import './ImportInvitationsPage.css';

const steps = ['Seleccionar archivo', 'Revisar datos', 'Confirmar e importar'];

function ImportIcon({ name }: { name: 'file' | 'download' | 'upload' | 'check' | 'user' | 'columns' | 'document' | 'plus' }) {
  const paths = {
    file: <><path d="M7 3.5h6l4 4V20H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M13 3.5V8h4M8.5 12h6M8.5 15h6" /></>,
    download: <><path d="M12 3v11m0 0-4-4m4 4 4-4M4.5 16v4h15v-4" /></>,
    upload: <><path d="M12 17V5m0 0-4 4m4-4 4 4M4.5 17v3h15v-3" /></>,
    check: <path d="m5 12 4.2 4.2L19 6.5" />,
    user: <><circle cx="12" cy="7" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></>,
    columns: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 20V9" /></>,
    document: <><path d="M7 3.5h6l4 4V20H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" /><path d="M13 3.5V8h4M8.5 12h6M8.5 15h4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function ImportInvitationsPage() {
  const { state, selectFile } = useImportPreview();
  const analysis = state.status === 'valid' || state.status === 'invalid' ? state.analysis : null;
  const execution = useImportExecution(analysis, state.status === 'empty' ? '' : state.filename);
  const confirmation = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  useEffect(() => {
    if (execution.phase === 'confirming') confirmation.current?.focus();
  }, [execution.phase]);

  const step = execution.session || execution.phase === 'running' || execution.phase === 'finished'
    ? 3 : state.status === 'valid' || state.status === 'invalid' || execution.phase === 'confirming' ? 2 : 1;
  const showPrivacy = state.status === 'valid' || state.status === 'invalid' || Boolean(execution.session);
  const handleFile = (file?: File) => {
    if (file && execution.reset()) void selectFile(file);
  };
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (!execution.fileBlocked) handleFile(event.dataTransfer.files[0]);
  };

  return <section aria-labelledby="import-title" className="import-page w-full min-w-0">
    <PageHeader className="invitation-page-header" title="Importar invitaciones" titleId="import-title" description="Crea tus invitaciones fácilmente desde un archivo de Excel." />

    <ol className="import-page__steps" aria-label="Etapas de importación">
      {steps.map((label, index) => <li key={label} className={index + 1 === step ? 'import-page__step import-page__step--current' : 'import-page__step'} aria-current={index + 1 === step ? 'step' : undefined}>
        <span className="import-page__step-number">{index + 1}</span><span>{label}</span>
      </li>)}
    </ol>

    <div className="import-page__card">
      <div className="import-page__card-header">
        <div className="import-page__card-heading">
          <span className="import-page__heading-icon"><ImportIcon name="file" /></span>
          <div><h2>Archivo de invitaciones</h2><p>Selecciona tu archivo Excel con la lista de invitados.</p></div>
        </div>
        <div className="import-page__template">
          <a className="import-page__template-link" href={`${import.meta.env.BASE_URL}templates/plantilla-invitaciones-v1.xlsx`} download="plantilla-invitaciones-v1.xlsx"><ImportIcon name="download" />Descargar plantilla XLSX</a>
          <small>Usa este formato como ejemplo</small>
        </div>
      </div>

      <div className="import-page__columns">
        <div className={`import-page__upload${isDragging ? ' import-page__upload--dragging' : ''}`} onDragEnter={(event) => { event.preventDefault(); if (!execution.fileBlocked) setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
          <img className="import-page__illustration" src={excelIllustration} alt="" />
          <h3>Arrastra y suelta tu archivo XLSX aquí</h3>
          <p>o haz clic para seleccionarlo</p>
          <input id="import-file" type="file" disabled={execution.fileBlocked} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="visually-hidden" aria-label="Seleccionar archivo XLSX" onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            handleFile(file);
          }} />
          <label className={`import-page__select${execution.fileBlocked ? ' import-page__select--disabled' : ''}`} htmlFor="import-file"><ImportIcon name="upload" />Seleccionar archivo</label>
          <ul className="import-page__checks">
            <li><ImportIcon name="check" />Solo archivos .xlsx</li>
            <li><ImportIcon name="check" />Una invitación por fila</li>
            <li><ImportIcon name="check" />Sin fórmulas</li>
          </ul>
        </div>

        <aside className="import-page__instructions" aria-labelledby="import-instructions-title">
          <h2 id="import-instructions-title">Instrucciones</h2>
          <p className="import-page__instructions-intro">Sigue estas recomendaciones para evitar errores.</p>
          <ul>
            <li><span className="import-page__instruction-icon" aria-hidden="true"><ImportIcon name="user" /></span><div><strong>Una invitación por fila</strong><p>Cada fila del Excel será una invitación.</p></div></li>
            <li><span className="import-page__instruction-icon" aria-hidden="true"><ImportIcon name="columns" /></span><div><strong>Una persona por columna</strong><p>Llena los nombres en columnas separadas (invitado 1, invitado 2, etc.).</p></div></li>
            <li><span className="import-page__instruction-icon" aria-hidden="true"><ImportIcon name="document" /></span><div><strong>Usa solo valores</strong><p>No uses fórmulas en el Excel.</p></div></li>
            <li><span className="import-page__instruction-icon" aria-hidden="true"><ImportIcon name="plus" /></span><div><strong>Puedes agregar más columnas</strong><p>Si necesitas más invitados, agrega más columnas consecutivamente (invitado 3, 4, etc.).</p></div></li>
          </ul>
        </aside>
      </div>
      {showPrivacy && <p className="import-page__privacy">El XLSX se procesa localmente. Al confirmar, los datos normalizados y sus claves se guardan en este navegador antes de enviarse a Boda-API. Si existe una sesión, debes continuarla, finalizarla o descartarla antes de elegir otro archivo.</p>}
    </div>

    <div className="import-page__status" role="status" aria-live="polite">
      {execution.previewConsumed && !execution.session && execution.phase === 'idle' && <p>Selecciona un archivo nuevo para comenzar otra importación. Volver a importar el mismo Excel puede crear duplicados.</p>}
      {!execution.previewConsumed && !execution.session && <>
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

    <div className="import-page__actions">
      <div className="import-page__primary-actions">
        <Button id="start-import" type="button" variant="primary" disabled={!execution.eligible} onClick={execution.open}>Continuar <span aria-hidden="true">→</span></Button>
        <ButtonLink variant="secondary" to="/invitaciones">Volver a invitaciones</ButtonLink>
      </div>
      {execution.phase === 'confirming' && analysis && <div ref={confirmation} tabIndex={-1} role="region" aria-label="Confirmar importación" className="import-page__confirmation">
        <h2>Confirmar importación</h2>
        <p>Se crearán {analysis.invitations.length} invitaciones con {analysis.summary.totalSlots} cupos en total.</p>
        <p>Se guardará una sesión local para recuperar esta importación si se interrumpe. Si ocurre un fallo, se detendrá y las invitaciones ya creadas se conservarán. No borres los datos de este navegador.</p>
        <div className="import-page__confirmation-actions">
          <Button type="button" variant="secondary" onClick={() => { execution.cancel(); requestAnimationFrame(() => document.getElementById('start-import')?.focus()); }}>Cancelar</Button>
          <Button type="button" variant="primary" onClick={() => { void execution.confirm(); }}>Crear invitaciones</Button>
        </div>
      </div>}
      {execution.error && <p className="import-page__error" role="alert">{execution.error}</p>}
      {execution.items.length > 0 && <ImportResults items={execution.items} running={execution.phase === 'running'} reconciling={execution.reconciling} storageBlocked={execution.storageBlocked} />}
      {(execution.storageBlocked || execution.error) && <Button className="import-page__refresh" type="button" variant="secondary" disabled={execution.phase === 'running' || execution.phase === 'loading' || execution.phase === 'confirming'} onClick={() => { void execution.refresh(); }}>Comprobar sesión local</Button>}
    </div>
  </section>;
}
