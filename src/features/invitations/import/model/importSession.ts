import type { CreateInvitationInput } from '../../model/invitation.types';
import { prepareImport, type ImportItem } from './importExecution';
import type { ImportAnalysis } from './import.types';

export class ImportSessionError extends Error {}
export class ImportStorageError extends ImportSessionError {}
export class ImportSessionChangedError extends ImportSessionError {
  readonly session: ImportSession;
  constructor(session: ImportSession) {
    super('La sesión avanzó o cambió desde que abriste la confirmación. Revisa los resultados actuales y vuelve a confirmar el descarte.');
    this.session = session;
  }
}
export interface ImportSession {
  formatVersion: 1;
  id: string;
  filename: string;
  createdAt: string;
  updatedAt: string;
  apiBaseUrl: string;
  fingerprint: string;
  status: 'incomplete' | 'completed';
  items: ImportItem[];
}

export async function fingerprint(inputs: CreateInvitationInput[]): Promise<string> {
  const logical = inputs.map(input => [input.displayName, input.knownGuests.map(guest => guest.name), input.openSlots, input.replacementsAllowed]);
  const bytes = new TextEncoder().encode(JSON.stringify(['boda-import-logical:v1', logical]));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function newImportSession(analysis: ImportAnalysis, filename: string): Promise<ImportSession> {
  const items = prepareImport(analysis);
  const now = new Date().toISOString();
  return { formatVersion: 1, id: crypto.randomUUID(), filename, createdAt: now, updatedAt: now,
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL, fingerprint: await fingerprint(items.map(item => item.payload)),
    status: 'incomplete', items };
}

export function recoverSession(session: ImportSession): ImportSession {
  return { ...session, items: session.items.map(item => item.status === 'creating' || (item.status === 'pending' && item.mayHaveBeenCreated)
    ? { ...item, status: 'unknown', mayHaveBeenCreated: true, error: 'La ejecución se interrumpió. Se debe reconciliar con la misma clave.' } : item) };
}

export function hasUnconfirmedCreation(item: ImportItem): boolean {
  return item.status !== 'created' && (item.status === 'creating' || item.status === 'unknown' || item.mayHaveBeenCreated === true);
}

export function discardRevision(session: ImportSession): string {
  return JSON.stringify([session.id, session.fingerprint, session.apiBaseUrl, session.items.map(item => [
    item.row, item.idempotencyKey, item.status === 'creating' ? 'unknown' : item.status,
    item.invitationId ?? null, hasUnconfirmedCreation(item),
  ])]);
}

export function retryableFailure(item: ImportItem): boolean {
  return item.status === 'failed' && [401, 403, 429].includes(item.errorStatus ?? 0);
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const fields = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
function validPayload(value: unknown): value is CreateInvitationInput {
  if (!record(value) || !fields(value, ['displayName', 'knownGuests', 'openSlots', 'replacementsAllowed'])) return false;
  if (!nonempty(value.displayName) || value.displayName !== value.displayName.trim() || !Array.isArray(value.knownGuests) ||
    typeof value.openSlots !== 'number' || !Number.isSafeInteger(value.openSlots) || value.openSlots < 0 ||
    typeof value.replacementsAllowed !== 'boolean') return false;
  return value.knownGuests.every(guest => record(guest) && fields(guest, ['name']) && nonempty(guest.name) && guest.name === guest.name.trim()) &&
    Number.isSafeInteger(value.openSlots + value.knownGuests.length) && value.openSlots + value.knownGuests.length > 0;
}

// Stored data is untrusted. Never repair payloads, keys, IDs or unknown schemas silently.
export async function validateSession(value: unknown): Promise<ImportSession> {
  const invalid = () => { throw new ImportSessionError('La sesión local está dañada o usa una versión incompatible. No se enviará ninguna invitación ni se reemplazarán sus claves.'); };
  if (!record(value) || !fields(value, ['formatVersion', 'id', 'filename', 'createdAt', 'updatedAt', 'apiBaseUrl', 'fingerprint', 'status', 'items']) ||
    value.formatVersion !== 1 || !nonempty(value.id) || typeof value.filename !== 'string' ||
    !nonempty(value.createdAt) || !Number.isFinite(Date.parse(value.createdAt)) ||
    !nonempty(value.updatedAt) || !Number.isFinite(Date.parse(value.updatedAt)) ||
    !nonempty(value.apiBaseUrl) || typeof value.fingerprint !== 'string' ||
    !['incomplete', 'completed'].includes(value.status as string) || !Array.isArray(value.items) || value.items.length === 0) return invalid();
  const keys = new Set<string>();
  let lastRow = 1;
  for (const item of value.items) {
    if (!record(item) || !fields(item, ['row', 'displayName', 'payload', 'idempotencyKey', 'status', 'invitationId', 'version', 'error', 'errorStatus', 'mayHaveBeenCreated']) ||
      typeof item.row !== 'number' || !Number.isSafeInteger(item.row) || item.row <= lastRow ||
      !validPayload(item.payload) || item.displayName !== item.payload.displayName ||
      typeof item.idempotencyKey !== 'string' || !/^boda-import-v1:[0-9a-f-]{36}$/i.test(item.idempotencyKey) || keys.has(item.idempotencyKey) ||
      !['pending', 'creating', 'created', 'failed', 'unknown'].includes(item.status as string) ||
      (item.status === 'created' ? !nonempty(item.invitationId) : item.invitationId !== undefined) ||
      (item.version !== undefined && typeof item.version !== 'string') ||
      (item.mayHaveBeenCreated !== undefined && typeof item.mayHaveBeenCreated !== 'boolean') ||
      (item.status === 'created' && item.mayHaveBeenCreated === true) ||
      (item.error !== undefined && (typeof item.error !== 'string' || item.error.length > 1000)) ||
      (item.errorStatus !== undefined && (typeof item.errorStatus !== 'number' || !Number.isInteger(item.errorStatus) || item.errorStatus < 100 || item.errorStatus > 599))) return invalid();
    keys.add(item.idempotencyKey); lastRow = item.row;
  }
  const session = value as unknown as ImportSession;
  if ((session.status === 'completed') !== session.items.every(item => item.status === 'created') ||
    await fingerprint(session.items.map(item => item.payload)) !== session.fingerprint) return invalid();
  return session;
}
