import { ApiError } from '../../../../services/http/apiClient';
import { createInvitation } from '../../api/invitationService';
import type { CreateInvitationInput } from '../../model/invitation.types';
import type { ImportAnalysis } from './import.types';

export interface ImportItem {
  row: number;
  displayName: string;
  payload: CreateInvitationInput;
  idempotencyKey: string;
  status: 'pending' | 'creating' | 'created' | 'failed' | 'unknown';
  invitationId?: string;
  version?: string;
  error?: string;
}

export function canImport(analysis: ImportAnalysis | null): analysis is ImportAnalysis {
  return !!analysis && analysis.valid && analysis.summary.errors === 0 &&
    !analysis.issues.some(issue => issue.severity === 'error') &&
    analysis.invitations.length > 0 && analysis.invitations.every(row => row.valid && row.input !== null);
}

export function prepareImport(analysis: ImportAnalysis): ImportItem[] {
  if (!canImport(analysis)) throw new Error('El archivo debe ser completamente válido.');
  const keys = new Set<string>();
  return analysis.invitations.map(row => {
    const idempotencyKey = `boda-import-v1:${crypto.randomUUID()}`;
    // Fail closed before sending anything if the random source malfunctions.
    if (keys.has(idempotencyKey) || !/^[A-Za-z0-9._:-]{1,200}$/.test(idempotencyKey)) {
      throw new Error('No se pudo preparar la importación.');
    }
    keys.add(idempotencyKey);
    const input = row.input!;
    return { row: row.row, displayName: input.displayName, idempotencyKey, status: 'pending',
      payload: { displayName: input.displayName, knownGuests: input.knownGuests.map(({ name }) => ({ name })),
        openSlots: input.openSlots, replacementsAllowed: input.replacementsAllowed } };
  });
}

export function creationError(error: unknown): Pick<ImportItem, 'status' | 'error'> {
  if (!(error instanceof ApiError) || error.status < 400 || error.status >= 500 || error.status === 408) {
    return { status: 'unknown', error: 'No se pudo confirmar el resultado. La invitación podría haberse creado. No repitas manualmente esta operación con una clave nueva.' };
  }
  const messages: Record<number, string> = {
    400: 'La API rechazó los datos de la invitación. Revisa la información antes de continuar.',
    401: 'La sesión no es válida. Se detuvo la importación.',
    403: 'No tienes permiso para crear esta invitación.',
    409: error.code === 'IDEMPOTENCY_CONFLICT' ? 'Conflicto de idempotencia. No se volverá a crear con otra clave.' : 'La API informó un conflicto al crear la invitación.',
    412: 'No se cumplen las condiciones para crear la invitación.',
    429: 'La API recibió demasiadas solicitudes. Se detuvo la importación.',
  };
  return { status: 'failed', error: messages[error.status] ?? 'La API rechazó la creación de la invitación.' };
}

export const CREATE_TIMEOUT_MS = 30_000;

// One awaited request at a time. Snapshots never mutate objects already given to React.
export async function executeImport(
  initial: ImportItem[], signal: AbortSignal, onChange: (items: ImportItem[]) => void,
  create: typeof createInvitation = createInvitation,
): Promise<void> {
  let items = initial;
  for (let index = 0; index < items.length; index++) {
    if (signal.aborted) return;
    const current = items[index];
    if (current.status !== 'pending') return;
    const update = (patch: Partial<ImportItem>) => {
      items = items.map((item, position) => position === index ? { ...item, ...patch } : item);
      if (!signal.aborted) onChange(items);
    };
    update({ status: 'creating' });
    const request = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abort!: () => void;
    const interrupted = new Promise<never>((_, reject) => {
      abort = () => { request.abort(); reject(new Error('Request interrupted')); };
      signal.addEventListener('abort', abort, { once: true });
      timer = setTimeout(abort, CREATE_TIMEOUT_MS);
    });
    try {
      const result = await Promise.race([
        create(current.payload, { idempotencyKey: current.idempotencyKey, signal: request.signal }), interrupted,
      ]);
      if (signal.aborted) return;
      if (!result || typeof result.id !== 'string' || !result.id.trim()) throw new Error('Unconfirmed response');
      update({ status: 'created', invitationId: result.id, version: result.version });
    } catch (error) {
      update(creationError(error));
      return;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
  }
}
