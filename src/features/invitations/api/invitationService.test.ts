import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createInvitation, getInvitations } from './invitationService';
import { ApiError } from '../../../services/http/apiClient';
import { executeImport, type ImportItem } from '../import/model/importExecution';
const { getIdToken } = vi.hoisted(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.test');
  return { getIdToken: vi.fn() };
});
vi.mock('../../../config/firebase', () => ({ auth: { currentUser: { getIdToken } } }));
const payload = { displayName: 'Familia', knownGuests: [{ name: 'B' }, { name: 'A' }], openSlots: 1, replacementsAllowed: true };
beforeEach(() => {
  getIdToken.mockResolvedValue('test-token');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'real', version: 'v1' }), { status: 201 })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('la creación manual sigue enviando el body original sin Idempotency-Key', async () => {
  await createInvitation(payload);
  const [url, options] = vi.mocked(fetch).mock.calls[0];
  expect(url).toBe('https://api.test/api/admin/invitations');
  expect(options?.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer test-token' });
  expect(JSON.parse(options!.body as string)).toEqual(payload);
});
it.each([200, 201])('acepta %s con header exacto y sin agregar claves al JSON', async status => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'real', version: 'v1' }), { status }));
  const result = await createInvitation(payload, { idempotencyKey: 'boda-import-v1:example' });
  expect(result.id).toBe('real');
  const options = vi.mocked(fetch).mock.calls[0][1]!;
  expect(options.headers).toHaveProperty('Idempotency-Key', 'boda-import-v1:example');
  expect(JSON.parse(options.body as string)).toEqual(payload);
});
it('conserva el código de conflicto normalizado sin exponer body crudo', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: { code: 'IDEMPOTENCY_CONFLICT', message: 'internal' } }), { status: 409 }));
  await expect(createInvitation(payload)).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_CONFLICT', validationMessage: undefined });
});
it('conserva el contrato existente de validación 400', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Dato no válido' } }), { status: 400 }));
  await expect(createInvitation(payload)).rejects.toMatchObject({ status: 400, validationMessage: 'Dato no válido' });
});
it('un body de error ilegible conserva el estado HTTP', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response('broken', { status: 409 }));
  await expect(createInvitation(payload)).rejects.toBeInstanceOf(ApiError);
});
it('no envía una petición abortada mientras esperaba el token', async () => {
  let resolve!: (token: string) => void;
  getIdToken.mockReturnValue(new Promise(done => { resolve = done; }));
  const controller = new AbortController();
  const request = createInvitation(payload, { signal: controller.signal, idempotencyKey: 'key' });
  controller.abort(); resolve('test-token');
  await expect(request).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
});

it('serializa búsqueda, filtros y paginación real en GET', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 15, totalPages: 0 }), { status: 200 }));
  await getInvitations({ search: '  América  ', rsvpStatus: 'partial', archived: false, page: 2, pageSize: 15 });
  expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://api.test/api/admin/invitations?search=Am%C3%A9rica&rsvpStatus=partial&archived=false&page=2&pageSize=15');
});

it.each([200, 201, 202, 206])('HTTP %s solo confirma creación si es 200/201, conservando orden y autenticación', async status => {
  vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ id: 'real', version: 'v1' }), { status }));
  let items: ImportItem[] = [2, 5].map(row => ({
    row, displayName: `Fila ${row}`, payload: { ...payload, displayName: `Fila ${row}` },
    idempotencyKey: `boda-import-v1:${crypto.randomUUID()}`, status: 'pending',
  }));
  const keys = items.map(item => item.idempotencyKey);
  await executeImport(items, new AbortController().signal, next => { items = next; });
  const confirmed = status === 200 || status === 201;
  expect(items.map(item => item.status)).toEqual(confirmed ? ['created', 'created'] : ['unknown', 'pending']);
  expect(fetch).toHaveBeenCalledTimes(confirmed ? 2 : 1);
  vi.mocked(fetch).mock.calls.forEach(([, options], index) => {
    expect(options!.headers).toHaveProperty('Authorization', 'Bearer test-token');
    expect(options!.headers).toHaveProperty('Idempotency-Key', keys[index]);
    expect(JSON.parse(options!.body as string)).toEqual({ ...payload, displayName: `Fila ${[2, 5][index]}` });
  });
  expect(items[0].invitationId).toBe(confirmed ? 'real' : undefined);
});
