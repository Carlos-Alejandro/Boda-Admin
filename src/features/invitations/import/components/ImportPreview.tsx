import type { ImportAnalysis, ImportIssue } from '../model/import.types';

export function ImportPreview({ analysis }: { analysis: ImportAnalysis }) {
  const { summary } = analysis;
  const issuesByRow = new Map<number, ImportIssue[]>();
  for (const issue of analysis.issues) if (issue.sheet === 'Invitaciones' && issue.row > 1) {
    const rowIssues = issuesByRow.get(issue.row) ?? [];
    rowIssues.push(issue);
    issuesByRow.set(issue.row, rowIssues);
  }
  const metrics = [
    ['Invitaciones encontradas', summary.invitations], ['Personas identificadas', summary.identifiedPeople],
    ['Espacios abiertos', summary.openSlots], ['Cupos totales', summary.totalSlots],
    ['Invitaciones válidas', summary.validInvitations], ['Invitaciones con errores', summary.invalidInvitations],
    ['Cantidad de errores', summary.errors], ['Cantidad de advertencias', summary.warnings],
  ] as const;
  return <div className="mt-5 space-y-5">
    <h2 className="font-admin-serif text-xl">Resumen del archivo</h2>
    {!analysis.valid && <p>Los totales de personas y cupos incluyen únicamente invitaciones válidas. Debes corregir todos los errores del archivo.</p>}
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map(([label, value]) => <div key={label} className="rounded-lg border border-admin-border bg-surface p-3">
        <dt className="text-sm text-admin-muted">{label}</dt><dd className="m-0 text-xl font-semibold break-words">{value}</dd>
      </div>)}
    </dl>
    {analysis.issues.length > 0 && <section aria-labelledby="import-issues-title">
      <h2 id="import-issues-title" className="font-admin-serif text-xl">Errores y advertencias</h2>
      <ul className="max-h-96 space-y-2 overflow-auto p-1">
        {analysis.issues.map((issue, index) => <li key={index} className="rounded-lg border border-admin-border bg-surface p-3 break-words">
          <strong className={issue.severity === 'error' ? 'text-admin-danger' : ''}>{issue.severity === 'error' ? 'Error' : 'Advertencia'} · {issue.sheet} · fila {issue.row} · {issue.column}</strong>
          <p className="mb-0 mt-1">{issue.message}</p>
        </li>)}
      </ul>
    </section>}
    <section aria-labelledby="import-invitations-title">
      <h2 id="import-invitations-title" className="font-admin-serif text-xl">Invitaciones interpretadas</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {analysis.invitations.map((invitation) => <article key={invitation.row} className="min-w-0 rounded-lg border border-admin-border bg-surface p-4 break-words">
          <h3 className="m-0 text-lg font-semibold">{invitation.displayName ?? 'Sin nombre válido'}</h3>
          <p>Fila {invitation.row} de Invitaciones</p>
          <p className={invitation.valid ? 'text-admin-green-700' : 'text-admin-danger'}>{invitation.valid ? 'Invitación válida' : 'Invitación con errores'}</p>
          <p className="mb-1 font-semibold">Personas identificadas:</p>
          {invitation.knownGuests.length ? <ul className="list-disc pl-5">{invitation.knownGuests.map((guest) => <li key={`${guest.row}:${guest.column}`}>{guest.name}</li>)}</ul> : <p>Sin personas identificadas.</p>}
          <p>Espacios abiertos: {invitation.openSlots ?? 'Valor inválido'}</p>
          <p>Sustituciones: {invitation.replacementsAllowed === null ? 'Valor inválido' : invitation.replacementsAllowed ? 'Sí' : 'No'}</p>
          <p>Cupos: {invitation.valid ? BigInt(invitation.knownGuests.length) + BigInt(invitation.openSlots!) + '' : 'Pendiente de corregir errores'}</p>
          {issuesByRow.has(invitation.row) && <ul className="list-disc pl-5" aria-label={`Observaciones de la fila ${invitation.row}`}>
            {issuesByRow.get(invitation.row)!.map((issue, index) => <li key={index}>
              {issue.severity === 'error' ? 'Error' : 'Advertencia'} · {issue.column}: {issue.message}
            </li>)}
          </ul>}
        </article>)}
      </div>
    </section>
  </div>;
}
