import { Button, ButtonLink } from '../../../shared/components/Button/Button';
import { PageHeader } from '../../../shared/components/PageHeader/PageHeader';
import { ImportPreview } from '../import/components/ImportPreview';
import { useImportPreview } from '../import/model/useImportPreview';

export function ImportInvitationsPage() {
  const { state, selectFile } = useImportPreview();
  return <section aria-labelledby="import-title" className="w-full text-sm">
    <PageHeader title="Importar invitaciones" titleId="import-title" eyebrow="Gestión de invitaciones" description="Lee y revisa tu Excel localmente. Esta etapa solo muestra una vista previa y no crea invitaciones." />
    <div className="mt-5 space-y-4 rounded-xl border border-admin-border bg-surface p-4">
      <a className="inline-block font-semibold underline" href={`${import.meta.env.BASE_URL}templates/plantilla-invitaciones-v1.xlsx`} download="plantilla-invitaciones-v1.xlsx">Descargar plantilla XLSX</a>
      <p>Completa únicamente la hoja Invitaciones: una invitación por fila y una persona por columna, desde Invitado 1, sin huecos. Puedes agregar más columnas Invitado N consecutivamente. No escribas códigos ni IDs; el sistema generará los IDs al crear las invitaciones en una etapa posterior. Usa valores, no fórmulas.</p>
      <label className="block font-semibold" htmlFor="import-file">Seleccionar archivo XLSX</label>
      <input id="import-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="block w-full min-w-0" onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void selectFile(file);
      }} />
      <p className="text-admin-muted">El archivo se procesa en este navegador y no se guarda ni se sube a un servidor. Seleccionar otro archivo reemplaza el análisis anterior.</p>
    </div>
    <div className="mt-4" role="status" aria-live="polite">
      {state.status === 'empty' && <p>Selecciona un archivo para comenzar.</p>}
      {state.status !== 'empty' && <p className="break-words">Archivo: {state.filename}</p>}
      {state.status === 'reading' && <p>Leyendo y validando todo el archivo…</p>}
      {state.status === 'valid' && <p>Archivo válido. Revisa la vista previa y las posibles advertencias.</p>}
      {state.status === 'invalid' && <p className="text-admin-danger">Archivo con errores. Corrige las celdas indicadas y vuelve a seleccionarlo.</p>}
      {state.status === 'read-error' && <p className="text-admin-danger">{state.message}</p>}
    </div>
    {(state.status === 'valid' || state.status === 'invalid') && <ImportPreview analysis={state.analysis} />}
    <div className="mt-6 space-y-3">
      <Button type="button" variant="primary" disabled aria-describedby="import-disabled-reason">Importar invitaciones</Button>
      <p id="import-disabled-reason">La creación se habilitará después de revisar la vista previa, en una etapa posterior del desarrollo.</p>
      <ButtonLink variant="text" to="/invitaciones">Volver a invitaciones</ButtonLink>
    </div>
  </section>;
}
