import { auth } from '../../../../config/firebase';
import { createInvitation } from '../../api/invitationService';
import { importSessionStore, withImportLock } from '../storage/importSessionStore';
import { executeImport, type ImportItem } from './importExecution';
import type { ImportAnalysis } from './import.types';
import { discardRevision, ImportSessionChangedError, ImportSessionError, newImportSession, recoverSession, retryableFailure, validateSession, type ImportSession } from './importSession';

export const sessionDependencies = {
  store: importSessionStore,
  lock: withImportLock,
  authenticated: () => !!auth.currentUser,
  create: createInvitation,
};
type Dependencies = typeof sessionDependencies;

function ensureAuthentication(deps: Dependencies) {
  if (!deps.authenticated()) throw new ImportSessionError('Inicia sesión para continuar. La sesión de importación local se conserva.');
}
function ensureEndpoint(session: ImportSession) {
  if (session.apiBaseUrl !== import.meta.env.VITE_API_BASE_URL) {
    throw new ImportSessionError('Esta sesión pertenece a otra configuración de Boda-API. No se enviarán sus operaciones a un servidor diferente.');
  }
}

async function run(session: ImportSession, signal: AbortSignal, onChange: (session: ImportSession) => void, deps: Dependencies) {
  let current = session;
  const snapshot = (items: ImportItem[]) => ({ ...current, items, updatedAt: new Date().toISOString(),
    status: items.every(item => item.status === 'created') ? 'completed' as const : 'incomplete' as const });
  await executeImport(current.items, signal, items => {
    current = snapshot(items);
    onChange(current); // Keep confirmed IDs in memory even if the following commit fails.
  }, async (payload, options) => {
    ensureAuthentication(deps);
    return deps.create(payload, options);
  }, async items => {
    current = snapshot(items);
    await deps.store.save(current);
  });
  return current;
}

export async function startImportSession(analysis: ImportAnalysis, filename: string, signal: AbortSignal,
  onChange: (session: ImportSession) => void, deps = sessionDependencies): Promise<void> {
  await deps.lock(async () => {
    const existing = await deps.store.load();
    if (signal.aborted) return;
    if (existing) { onChange(recoverSession(existing)); throw new ImportSessionError('Ya existe una sesión local. Continúala o descártala explícitamente antes de importar otro archivo.'); }
    ensureAuthentication(deps);
    const session = await newImportSession(analysis, filename);
    if (signal.aborted) return;
    onChange(session);
    await deps.store.save(session, true);
    if (!signal.aborted) await run(session, signal, onChange, deps);
  });
}

export async function resumeImportSession(id: string, signal: AbortSignal, onChange: (session: ImportSession) => void,
  deps = sessionDependencies, memory?: ImportSession): Promise<void> {
  await deps.lock(async () => {
    const stored = await deps.store.load();
    if (signal.aborted) return;
    ensureAuthentication(deps);
    if (!stored || stored.id !== id) throw new ImportSessionError('La sesión local cambió o ya no existe. Comprueba su estado antes de continuar.');
    ensureEndpoint(stored);
    let session = recoverSession(stored);
    if (memory?.id === id && (memory.fingerprint !== session.fingerprint || memory.items.length !== session.items.length ||
      memory.items.some((item, index) => item.idempotencyKey !== session.items[index].idempotencyKey))) {
      throw new ImportSessionError('El contenido o las claves de la sesión local cambiaron. Se bloqueó la reanudación para evitar una operación diferente.');
    }
    // Retain acknowledged IDs after a failed commit, without downgrading disk state.
    if (memory?.id === id) {
      await validateSession(memory);
      session = { ...session, items: session.items.map((item, index) => item.status !== 'created' && memory.items[index].status === 'created' ? memory.items[index] : item) };
      session.status = session.items.every(item => item.status === 'created') ? 'completed' : 'incomplete';
      session.updatedAt = new Date().toISOString();
      await deps.store.save(session);
    }
    onChange(session);
    if (session.status === 'completed') return;
    if (session.items.some(item => item.status === 'failed' && !retryableFailure(item))) {
      throw new ImportSessionError('La sesión contiene un fallo bloqueante. No se cambiarán payloads ni claves y no se crearán filas posteriores. Revisa el error antes de descartar la sesión.');
    }
    session.items = session.items.map(item => retryableFailure(item) ? { ...item, status: item.mayHaveBeenCreated ? 'unknown' as const : 'pending' as const, error: undefined, errorStatus: undefined } : item);
    await deps.store.save(session);
    if (!signal.aborted) await run(session, signal, onChange, deps);
  });
}

export async function removeImportSession(id: string, completedOnly: boolean, deps = sessionDependencies, expected?: ImportSession): Promise<void> {
  await deps.lock(async () => {
    if (!completedOnly && !expected) throw new ImportSessionError('Debes confirmar el estado de la sesión antes de descartarla.');
    const session = await deps.store.load();
    if (!session && !completedOnly) return;
    if (!session || session.id !== id || (completedOnly && session.status !== 'completed')) {
      throw new ImportSessionError('La sesión cambió. Comprueba el estado local antes de eliminarla.');
    }
    if (!completedOnly && expected) {
      let current = recoverSession(session);
      // A failed commit may leave confirmed IDs only in the approving tab.
      if (expected.id === current.id && expected.fingerprint === current.fingerprint && expected.items.length === current.items.length &&
        expected.items.every((item, index) => item.idempotencyKey === current.items[index].idempotencyKey)) {
        current = { ...current, items: current.items.map((item, index) => item.status !== 'created' && expected.items[index].status === 'created' ? expected.items[index] : item) };
        current.status = current.items.every(item => item.status === 'created') ? 'completed' : 'incomplete';
      }
      if (discardRevision(current) !== discardRevision(expected)) throw new ImportSessionChangedError(current);
    }
    await deps.store.remove(id);
  });
}
