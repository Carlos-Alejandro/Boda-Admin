import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../../services/http/apiClient';
import type { Invitation } from '../../model/invitation.types';
import { buildImportPreview } from './buildImportPreview';
import { canImport, CREATE_TIMEOUT_MS, executeImport, prepareImport, type ImportItem } from './importExecution';

vi.hoisted(() => { vi.stubEnv('VITE_API_BASE_URL', 'https://api.test'); });
vi.mock('../../../../config/firebase', () => ({ auth: { currentUser: null } }));
const preview = () => buildImportPreview([2, 4, 5].map(row => ({
  row, displayName: 'Familia', knownGuests: [{ name: 'B', row, column: 4 }, { name: 'A', row, column: 5 }],
  openSlots: 1, replacementsAllowed: true, valid: true,
  input: { displayName: 'Familia', knownGuests: [{ name: 'B' }, { name: 'A' }], openSlots: 1, replacementsAllowed: true },
})), []);
const response = (id = 'real-id') => ({ id, version: 'v1' }) as Invitation;
const deferred = () => {
  let resolve!: (result: Invitation) => void;
  const promise = new Promise<Invitation>(done => { resolve = done; });
  return { promise, resolve };
};
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('elegibilidad e identidad de ejecución', () => {
  it('acepta advertencias y rechaza cualquier error global aunque todas las filas sean válidas', () => {
    const analysis = preview();
    analysis.issues.push({ severity: 'warning', sheet: 'Invitaciones', row: 4, column: '', code: 'DUPLICATE', message: 'Repetida' });
    expect(canImport(analysis)).toBe(true);
    analysis.issues[0].severity = 'error';
    expect(canImport(analysis)).toBe(false);
    expect(() => prepareImport(analysis)).toThrow();
  });
  it.each(['empty', 'invalid', 'null-input', 'summary-error', 'global-invalid'])('rechaza %s', kind => {
    const analysis = preview();
    if (kind === 'empty') analysis.invitations = [];
    if (kind === 'invalid') analysis.invitations[1].valid = false;
    if (kind === 'null-input') analysis.invitations[1].input = null;
    if (kind === 'summary-error') analysis.summary.errors = 1;
    if (kind === 'global-invalid') analysis.valid = false;
    expect(canImport(analysis)).toBe(false);
  });
  it('crea claves independientes compatibles sin datos personales y copia solo el payload en orden', () => {
    const analysis = preview();
    const items = prepareImport(analysis);
    expect(new Set(items.map(item => item.idempotencyKey)).size).toBe(3);
    for (const item of items) expect(item.idempotencyKey).toMatch(/^boda-import-v1:[A-Za-z0-9-]+$/);
    for (const item of items) expect(item.idempotencyKey).toMatch(/^[A-Za-z0-9._:-]{1,200}$/);
    expect(items.map(item => item.row)).toEqual([2, 4, 5]);
    expect(items[0].payload).toEqual(analysis.invitations[0].input);
    analysis.invitations[0].input!.knownGuests[0].name = 'Cambiado';
    expect(items[0].payload.knownGuests.map(guest => guest.name)).toEqual(['B', 'A']);
  });
  it('rechaza colisiones del generador antes de ejecutar', () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000');
    expect(() => prepareImport(preview())).toThrow();
  });
});

describe('secuencia conservadora', () => {
  it('espera cada respuesta, conserva claves en cada snapshot y termina con IDs/versiones reales', async () => {
    const first = deferred(); const second = deferred();
    const create = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockResolvedValue(response('tercera'));
    const items = prepareImport(preview());
    const snapshots: ImportItem[][] = [];
    const run = executeImport(items, new AbortController().signal, next => snapshots.push(next), create);
    expect(create).toHaveBeenCalledTimes(1);
    first.resolve(response('primera')); await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(snapshots.at(-1)?.map(item => item.status)).toEqual(['created', 'creating', 'pending']);
    second.resolve(response('segunda')); await run;
    expect(create).toHaveBeenCalledTimes(3);
    expect(snapshots.at(-1)?.map(item => item.invitationId)).toEqual(['primera', 'segunda', 'tercera']);
    expect(snapshots.at(-1)?.every(item => item.version === 'v1')).toBe(true);
    for (const snapshot of snapshots) expect(snapshot.map(item => item.idempotencyKey)).toEqual(items.map(item => item.idempotencyKey));
    create.mock.calls.forEach((call, index) => expect(call[1].idempotencyKey).toBe(items[index].idempotencyKey));
  });
  it.each([400, 401, 403, 409, 412, 429, 500, 503, 408, 'network'] as const)('detiene ante %s sin reintento ni rollback', async status => {
    const error = status === 'network' ? new TypeError('sensitive internal detail') : new ApiError(status, 'private backend data', status === 409 ? 'IDEMPOTENCY_CONFLICT' : undefined);
    const create = vi.fn().mockResolvedValueOnce(response()).mockRejectedValue(error);
    const items = prepareImport(preview());
    let final = items;
    await executeImport(items, new AbortController().signal, next => { final = next; }, create);
    expect(create).toHaveBeenCalledTimes(2);
    expect(final.map(item => item.status)).toEqual(['created', status === 'network' || status >= 500 || status === 408 ? 'unknown' : 'failed', 'pending']);
    expect(final[0].invitationId).toBe('real-id');
    expect(final[1].invitationId).toBeUndefined();
    expect(final[2].invitationId).toBeUndefined();
    expect(final[1].error).not.toMatch(/private|sensitive/);
    if (status === 409) expect(final[1].error).toContain('idempotencia');
    expect(final.map(item => item.idempotencyKey)).toEqual(items.map(item => item.idempotencyKey));
  });
  it('timeout es unknown y una respuesta tardía no inicia otra petición', async () => {
    vi.useFakeTimers(); const pending = deferred();
    const create = vi.fn().mockReturnValue(pending.promise);
    let final = prepareImport(preview());
    const run = executeImport(final, new AbortController().signal, next => { final = next; }, create);
    await vi.advanceTimersByTimeAsync(CREATE_TIMEOUT_MS); await run;
    expect(final[0].status).toBe('unknown');
    expect(create.mock.calls[0][1].signal.aborted).toBe(true);
    pending.resolve(response()); await Promise.resolve();
    expect(create).toHaveBeenCalledTimes(1);
    expect(final[0].status).toBe('unknown');
  });
  it('abortar al salir no programa más filas ni publica respuestas tardías', async () => {
    const pending = deferred(); const create = vi.fn().mockReturnValue(pending.promise);
    const controller = new AbortController(); const update = vi.fn();
    const run = executeImport(prepareImport(preview()), controller.signal, update, create);
    controller.abort(); await run; pending.resolve(response()); await Promise.resolve();
    expect(create).toHaveBeenCalledTimes(1); expect(update).toHaveBeenCalledTimes(1);
  });
  it('respuesta exitosa sin ID confirmado es unknown', async () => {
    let final = prepareImport(preview());
    const create = vi.fn().mockResolvedValue({});
    await executeImport(final, new AbortController().signal, next => { final = next; }, create);
    expect(final[0].status).toBe('unknown'); expect(create).toHaveBeenCalledTimes(1);
  });
});
