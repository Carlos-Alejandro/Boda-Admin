import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBDatabase, IDBObjectStore } from 'fake-indexeddb';
import { importSessionStore, withImportLock } from '../storage/importSessionStore';
import { deferred, installImportBrowser, sessionPreview } from '../../../../../tests/importTestSupport';
import { fingerprint, newImportSession, recoverSession, validateSession, type ImportSession } from './importSession';
import { removeImportSession, resumeImportSession, sessionDependencies, startImportSession } from './importSessionController';

const { auth } = vi.hoisted(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.test');
  return { auth: { currentUser: { getIdToken: vi.fn().mockResolvedValue('private-token') } as { getIdToken: () => Promise<string> } | null } };
});
vi.mock('../../../../config/firebase', () => ({ auth }));
const response = (status = 201, id = 'REAL001') => new Response(JSON.stringify(status < 300 ? { id, version: 'v1' } : { error: { code: status === 409 ? 'IDEMPOTENCY_CONFLICT' : 'ERROR', message: 'internal private' } }), { status });
const signal = () => new AbortController().signal;
const observe = () => {
  let session: ImportSession | undefined;
  return { change: (next: ImportSession) => { session = next; }, get: () => session! };
};
beforeEach(() => {
  installImportBrowser();
  auth.currentUser = { getIdToken: vi.fn().mockResolvedValue('private-token') };
  vi.stubGlobal('fetch', vi.fn(async () => response()));
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('fingerprint y esquema persistido', () => {
  it('es estable para mismo contenido, independiente de nombre de archivo/filas físicas, e incluye el orden', async () => {
    const first = await newImportSession(sessionPreview(), 'uno.xlsx');
    const second = await newImportSession(sessionPreview(), 'dos.xlsx');
    expect(second.fingerprint).toBe(first.fingerprint);
    expect(second.id).not.toBe(first.id);
    expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    const inputs = first.items.map(item => item.payload);
    expect(await fingerprint([...inputs].reverse())).not.toBe(first.fingerprint);
    const moved = sessionPreview(); moved.invitations.forEach(item => { item.row += 10; });
    expect((await newImportSession(moved, 'otro.xlsx')).fingerprint).toBe(first.fingerprint);
  });
  it.each(['displayName', 'knownGuests', 'guestOrder', 'openSlots', 'replacementsAllowed'])('fingerprint cambia al modificar %s', async field => {
    const session = await newImportSession(sessionPreview(), 'test.xlsx');
    const inputs = structuredClone(session.items.map(item => item.payload));
    if (field === 'displayName') inputs[0].displayName = 'Otro';
    if (field === 'knownGuests') inputs[0].knownGuests[0].name = 'Otra persona';
    if (field === 'guestOrder') inputs[0].knownGuests.reverse();
    if (field === 'openSlots') inputs[0].openSlots++;
    if (field === 'replacementsAllowed') inputs[0].replacementsAllowed = false;
    expect(await fingerprint(inputs)).not.toBe(session.fingerprint);
  });
  it.each(['version', 'payload', 'duplicateKey', 'createdWithoutId', 'falseCompleted', 'extraPayload'])('rechaza sesión inválida: %s', async kind => {
    const session = await newImportSession(sessionPreview(), 'test.xlsx');
    if (kind === 'version') Object.assign(session, { formatVersion: 2 });
    if (kind === 'payload') session.items[0].payload.displayName = 'Cambiado';
    if (kind === 'duplicateKey') session.items[1].idempotencyKey = session.items[0].idempotencyKey;
    if (kind === 'createdWithoutId') session.items[0].status = 'created';
    if (kind === 'falseCompleted') session.status = 'completed';
    if (kind === 'extraPayload') Object.assign(session.items[0].payload, { idempotencyKey: 'contamination' });
    await expect(validateSession(session)).rejects.toThrow(/dañada/);
  });
});

describe('durabilidad y ejecución', () => {
  it('guarda batch y creating antes de cada POST; resultado antes del siguiente; no guarda credenciales', async () => {
    const uuid = vi.spyOn(crypto, 'randomUUID');
    const save = vi.spyOn(importSessionStore, 'save');
    const observer = observe();
    let index = 0;
    vi.mocked(fetch).mockImplementation(async (_url, options) => {
      const stored = (await importSessionStore.load())!;
      expect(stored.items[index].status).toBe('creating');
      expect(options?.headers).toHaveProperty('Idempotency-Key', stored.items[index].idempotencyKey);
      expect(options?.headers).toHaveProperty('Authorization', 'Bearer private-token');
      expect(JSON.parse(options!.body as string)).toEqual(stored.items[index].payload);
      if (index > 0) expect(stored.items[index - 1].invitationId).toBe(`ID${index - 1}`);
      return response(201, `ID${index++}`);
    });
    await startImportSession(sessionPreview(), 'test.xlsx', signal(), observer.change);
    expect(fetch).toHaveBeenCalledTimes(3); expect(uuid).toHaveBeenCalledTimes(4);
    expect(save).toHaveBeenCalledTimes(7);
    const stored = (await importSessionStore.load())!;
    expect(stored.status).toBe('completed'); expect(stored.items.map(item => item.invitationId)).toEqual(['ID0', 'ID1', 'ID2']);
    expect(JSON.stringify(stored)).not.toMatch(/private-token|Authorization|Bearer|stack|arrayBuffer/);
    expect(stored.items.map(item => item.idempotencyKey)).toEqual(observer.get().items.map(item => item.idempotencyKey));
  });
  it.each([1, 2])('fallo del commit %s antes del primer POST impide enviarlo', async failingCall => {
    const save = importSessionStore.save.bind(importSessionStore);
    let calls = 0;
    vi.spyOn(importSessionStore, 'save').mockImplementation(async (...args) => {
      if (++calls === failingCall) throw new Error('quota');
      return save(...args);
    });
    const observer = observe();
    await expect(startImportSession(sessionPreview(), 'test.xlsx', signal(), observer.change)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled(); expect(observer.get().items).toHaveLength(3);
  });
  it('request success no equivale a commit: abortar transacción impide el POST', async () => {
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args) {
      const request = put.apply(this, args);
      request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(startImportSession(sessionPreview(), 'test.xlsx', signal(), () => {})).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled(); expect(await importSessionStore.load()).toBeNull();
  });
  it('si falla guardar created conserva ID en memoria, detiene y repara sin reenviar created', async () => {
    const save = importSessionStore.save.bind(importSessionStore);
    let calls = 0;
    vi.spyOn(importSessionStore, 'save').mockImplementation(async (...args) => {
      if (++calls === 3) throw new Error('quota');
      return save(...args);
    });
    const observer = observe();
    await expect(startImportSession(sessionPreview(), 'test.xlsx', signal(), observer.change)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(observer.get().items[0].invitationId).toBe('REAL001');
    expect((await importSessionStore.load())!.items[0].status).toBe('creating');
    await resumeImportSession(observer.get().id, signal(), observer.change, sessionDependencies, observer.get());
    expect(fetch).toHaveBeenCalledTimes(3);
    expect((await importSessionStore.load())!.status).toBe('completed');
  });
  it('no sobrescribe una sesión pendiente aunque la pestaña tenga otro Excel válido', async () => {
    const stored = await newImportSession(sessionPreview(), 'original.xlsx'); await importSessionStore.save(stored, true);
    const uuid = vi.spyOn(crypto, 'randomUUID');
    await expect(startImportSession(sessionPreview(), 'nuevo.xlsx', signal(), () => {})).rejects.toThrow(/Ya existe/);
    expect(fetch).not.toHaveBeenCalled(); expect(uuid).not.toHaveBeenCalled();
    expect((await importSessionStore.load())!.id).toBe(stored.id);
  });
});

describe('recuperación y reconciliación', () => {
  it.each([
    ['A', 'pending', false],
    ['B', 'creating', false],
    ['C sin creación del servidor', 'creating', false],
    ['C con creación del servidor', 'creating', true],
    ['D', 'creating', true],
    ['E', 'creating', true],
    ['F', 'created', true],
  ] as const)('crash %s: reload conserva identidad y produce una sola invitación', async (_scenario, status, serverCreated) => {
    const original = await newImportSession(sessionPreview([2]), 'crash.xlsx');
    original.items[0].status = status;
    if (status === 'created') {
      original.items[0].invitationId = 'SERVER-ID';
      original.status = 'completed';
    }
    await importSessionStore.save(original, true);
    // Model durable server receipts independently from browser memory.
    const receipts = new Map<string, string>();
    let creations = serverCreated ? 1 : 0;
    if (serverCreated) receipts.set(original.items[0].idempotencyKey, JSON.stringify(original.items[0].payload));
    vi.mocked(fetch).mockImplementation(async (_url, options) => {
      const key = (options!.headers as Record<string, string>)['Idempotency-Key'];
      expect(key).toBe(original.items[0].idempotencyKey);
      expect(options!.body).toBe(JSON.stringify(original.items[0].payload));
      const replay = receipts.has(key);
      if (replay) expect(receipts.get(key)).toBe(options!.body);
      else { receipts.set(key, options!.body as string); creations++; }
      return response(replay ? 200 : 201, 'SERVER-ID');
    });
    const uuid = vi.spyOn(crypto, 'randomUUID');
    const restored = recoverSession((await importSessionStore.load())!);
    expect(restored.items[0].status).toBe(status === 'creating' ? 'unknown' : status);
    expect(fetch).not.toHaveBeenCalled();
    // Resume with no surviving in-memory result, as after a process crash.
    await resumeImportSession(restored.id, signal(), () => {});
    const final = (await importSessionStore.load())!;
    expect(final.status).toBe('completed');
    expect(final.items[0].invitationId).toBe('SERVER-ID');
    expect(final.items[0].idempotencyKey).toBe(original.items[0].idempotencyKey);
    expect(creations).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(status === 'created' ? 0 : 1);
    await resumeImportSession(final.id, signal(), () => {});
    expect(fetch).toHaveBeenCalledTimes(status === 'created' ? 0 : 1);
    expect(uuid).not.toHaveBeenCalled();
  });
  async function storedUnknown() {
    const session = await newImportSession(sessionPreview(), 'recuperado.xlsx');
    session.items[0].status = 'unknown';
    await importSessionStore.save(session, true); return session;
  }
  it('recarga: AAA111 creado, creating se reconcilia 200 BBB222, pendiente 201 CCC333; conserva las tres claves', async () => {
    const original = await newImportSession(sessionPreview(), 'test.xlsx');
    original.items[0] = { ...original.items[0], status: 'created', invitationId: 'AAA111', version: 'v1' };
    original.items[1].status = 'creating';
    await importSessionStore.save(original, true);
    const restored = recoverSession((await importSessionStore.load())!);
    expect(restored.items.map(item => item.status)).toEqual(['created', 'unknown', 'pending']);
    const random = vi.spyOn(crypto, 'randomUUID');
    vi.mocked(fetch).mockResolvedValueOnce(response(200, 'BBB222')).mockResolvedValueOnce(response(201, 'CCC333'));
    await resumeImportSession(restored.id, signal(), () => {});
    const final = (await importSessionStore.load())!;
    expect(final.items.map(item => item.invitationId)).toEqual(['AAA111', 'BBB222', 'CCC333']);
    expect(final.items[0].version).toBe('v1');
    expect(final.items.map(item => item.idempotencyKey)).toEqual(original.items.map(item => item.idempotencyKey));
    expect(final.status).toBe('completed'); expect(random).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.mocked(fetch).mock.calls.forEach(([, options], index) => {
      expect(options!.headers).toHaveProperty('Idempotency-Key', original.items[index + 1].idempotencyKey);
      expect(JSON.parse(options!.body as string)).toEqual(original.items[index + 1].payload);
    });
    await resumeImportSession(restored.id, signal(), () => {});
    expect(fetch).toHaveBeenCalledTimes(2);
    await removeImportSession(final.id, true); expect(await importSessionStore.load()).toBeNull();
  });
  it.each([200, 201, 202, 204, 206, 400, 401, 403, 408, 409, 412, 429, 500])('unknown + HTTP %s respeta semántica y detiene/continúa', async status => {
    const original = await storedUnknown();
    vi.mocked(fetch).mockResolvedValueOnce(status === 204 ? new Response(null, { status }) : response(status));
    await resumeImportSession(original.id, signal(), () => {});
    const final = (await importSessionStore.load())!;
    const confirmed = status === 200 || status === 201;
    const expected = confirmed ? 'created' : status < 400 || status === 408 || status >= 500 ? 'unknown' : 'failed';
    expect(final.items[0].status).toBe(expected);
    expect(final.items[0].mayHaveBeenCreated).toBe(confirmed ? undefined : true);
    expect(fetch).toHaveBeenCalledTimes(confirmed ? 3 : 1);
    expect(final.items[0].idempotencyKey).toBe(original.items[0].idempotencyKey);
    if (!confirmed) expect(final.items.slice(1).every(item => item.status === 'pending')).toBe(true);
    if (status === 409) expect(final.items[0].error).toContain('idempotencia');
  });
  it('error de red se mantiene unknown y no genera reintentos', async () => {
    const original = await storedUnknown();
    vi.mocked(fetch).mockRejectedValue(new TypeError('connection lost'));
    await resumeImportSession(original.id, signal(), () => {});
    expect((await importSessionStore.load())!.items[0].status).toBe('unknown'); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('timeout durante reconciliación persiste unknown e ignora respuesta tardía', async () => {
    const original = await storedUnknown();
    const pending = deferred<Response>();
    vi.mocked(fetch).mockImplementation(() => pending.promise);
    // Only virtualize timeouts, keeping IndexedDB's event loop real.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const run = resumeImportSession(original.id, signal(), () => {});
    while (vi.mocked(fetch).mock.calls.length === 0) await new Promise<void>(resolve => setImmediate(resolve));
    await vi.advanceTimersByTimeAsync(30_000); await run;
    expect((await importSessionStore.load())!.items[0].status).toBe('unknown');
    pending.resolve(response()); await Promise.resolve(); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('no empieza siguiente petición mientras la reconciliación siga activa', async () => {
    const original = await storedUnknown(); const pending = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(pending.promise);
    const run = resumeImportSession(original.id, signal(), () => {});
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect((await importSessionStore.load())!.items[1].status).toBe('pending');
    pending.resolve(response(200)); await run; expect(fetch).toHaveBeenCalledTimes(3);
  });
  it('reconcilia unknown antes que pending incluso si ocupa una posición posterior', async () => {
    const original = await newImportSession(sessionPreview(), 'test.xlsx'); original.items[1].status = 'unknown';
    await importSessionStore.save(original, true);
    await resumeImportSession(original.id, signal(), () => {});
    expect(vi.mocked(fetch).mock.calls.map(([, options]) => JSON.parse(options!.body as string).displayName)).toEqual(['Familia 3', 'Familia 2', 'Familia 4']);
  });
  it('no reintenta conflictos ni los salta', async () => {
    const original = await storedUnknown(); vi.mocked(fetch).mockResolvedValueOnce(response(409));
    await resumeImportSession(original.id, signal(), () => {});
    await expect(resumeImportSession(original.id, signal(), () => {})).rejects.toThrow(/bloqueante/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('permite reintento explícito de 401 con misma clave al recuperar autenticación', async () => {
    const original = await storedUnknown(); vi.mocked(fetch).mockResolvedValueOnce(response(401));
    await resumeImportSession(original.id, signal(), () => {});
    await resumeImportSession(original.id, signal(), () => {});
    expect(vi.mocked(fetch).mock.calls[1][1]!.headers).toHaveProperty('Idempotency-Key', original.items[0].idempotencyKey);
    expect((await importSessionStore.load())!.status).toBe('completed');
  });
  it('sin autenticación deja sesión intacta y no llama API', async () => {
    const original = await storedUnknown(); auth.currentUser = null;
    await expect(resumeImportSession(original.id, signal(), () => {})).rejects.toThrow(/Inicia sesión/);
    expect(await importSessionStore.load()).toEqual(original); expect(fetch).not.toHaveBeenCalled();
  });
  it('un cambio de Boda-API bloquea replay hacia otro destino', async () => {
    const original = await storedUnknown(); original.apiBaseUrl = 'https://other.test'; await importSessionStore.save(original);
    await expect(resumeImportSession(original.id, signal(), () => {})).rejects.toThrow(/otra configuración/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('un cambio de claves entre memoria y disco bloquea el POST en lugar de usar otra clave', async () => {
    const original = await storedUnknown(); const changed = structuredClone(original);
    changed.items[0].idempotencyKey = `boda-import-v1:${crypto.randomUUID()}`;
    await importSessionStore.save(changed);
    await expect(resumeImportSession(original.id, signal(), () => {}, sessionDependencies, original)).rejects.toThrow(/claves/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('solo conserva la versión de respuesta si respeta el tipo del contrato', async () => {
    const original = await storedUnknown();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ id: 'REAL', version: { privateData: 'must not persist' } }), { status: 200 }));
    await resumeImportSession(original.id, signal(), () => {});
    const stored = (await importSessionStore.load())!;
    expect(stored.items[0].invitationId).toBe('REAL');
    expect(stored.items[0].version).toBeUndefined();
    expect(JSON.stringify(stored)).not.toContain('privateData');
  });
  it('descarte es solo local, no hace rollback y no permite resucitar callbacks de otra pestaña', async () => {
    const original = await storedUnknown();
    await removeImportSession(original.id, false, sessionDependencies, original); expect(await importSessionStore.load()).toBeNull();
    await expect(resumeImportSession(original.id, signal(), () => {}, sessionDependencies, original)).rejects.toThrow(/ya no existe/);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('bloqueo entre pestañas y desmontaje', () => {
  it('solicita bloqueo exclusivo sin cola y lo libera también al fallar', async () => {
    await expect(withImportLock(async () => { throw new Error('interrupted'); })).rejects.toThrow('interrupted');
    expect(navigator.locks.request).toHaveBeenCalledWith('boda-import-session:v1', { mode: 'exclusive', ifAvailable: true }, expect.any(Function));
    await expect(withImportLock(async () => true)).resolves.toBe(true);
  });
  it('sin IndexedDB no guarda ni envía solicitudes', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(startImportSession(sessionPreview(), 'test.xlsx', signal(), () => {})).rejects.toThrow(/sesión local/);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('si el navegador ignora durability strict aborta antes del POST', async () => {
    const transaction = IDBDatabase.prototype.transaction;
    vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(function (this: IDBDatabase, ...args) {
      const tx = transaction.apply(this, args);
      if (args[1] === 'readwrite') Object.defineProperty(tx, 'durability', { value: 'relaxed' });
      return tx;
    });
    await expect(startImportSession(sessionPreview(), 'test.xlsx', signal(), () => {})).rejects.toThrow(/sesión local/);
    expect(fetch).not.toHaveBeenCalled();
    expect(await importSessionStore.load()).toBeNull();
  });
  it('sesión corrupta en IndexedDB bloquea inicio y reanudación sin rotar claves', async () => {
    const session = await newImportSession(sessionPreview(), 'test.xlsx');
    session.items[0].payload.knownGuests.reverse();
    await importSessionStore.save(session, true);
    const uuid = vi.spyOn(crypto, 'randomUUID');
    await expect(startImportSession(sessionPreview(), 'test.xlsx', signal(), () => {})).rejects.toThrow(/dañada/);
    await expect(resumeImportSession(session.id, signal(), () => {})).rejects.toThrow(/dañada/);
    expect(fetch).not.toHaveBeenCalled(); expect(uuid).not.toHaveBeenCalled();
  });
  it('dos ejecuciones y un descarte simultáneos no pueden usar la misma sesión', async () => {
    const session = await newImportSession(sessionPreview(), 'test.xlsx'); await importSessionStore.save(session, true);
    const pending = deferred<Response>(); vi.mocked(fetch).mockReturnValueOnce(pending.promise);
    const first = resumeImportSession(session.id, signal(), () => {});
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await expect(resumeImportSession(session.id, signal(), () => {})).rejects.toThrow(/Otra pestaña/);
    await expect(removeImportSession(session.id, false, sessionDependencies, session)).rejects.toThrow(/Otra pestaña/);
    expect(fetch).toHaveBeenCalledTimes(1);
    pending.resolve(response()); await first;
    expect((await importSessionStore.load())!.status).toBe('completed');
  });
  it('sin Web Locks falla cerrado, sin guardar ni crear', async () => {
    vi.stubGlobal('navigator', {});
    await expect(startImportSession(sessionPreview(), 'test.xlsx', signal(), () => {})).rejects.toThrow(/navegador/);
    expect(fetch).not.toHaveBeenCalled(); expect(await importSessionStore.load()).toBeNull();
  });
  it('abortar mantiene registro recuperable y libera lock sin programar más filas', async () => {
    const controller = new AbortController(); const pending = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(pending.promise);
    const run = startImportSession(sessionPreview(), 'test.xlsx', controller.signal, () => {});
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    controller.abort(); await run;
    expect((await importSessionStore.load())!.items.map(item => item.status)).toEqual(['unknown', 'pending', 'pending']);
    pending.resolve(response()); await Promise.resolve(); expect(fetch).toHaveBeenCalledTimes(1);
    await expect(withImportLock(async () => true)).resolves.toBe(true);
  });
  it('abortar mientras se guarda creating nunca envía el POST', async () => {
    const controller = new AbortController(); const save = importSessionStore.save.bind(importSessionStore);
    vi.spyOn(importSessionStore, 'save').mockImplementation(async (...args) => {
      await save(...args);
      if (args[0].items[0].status === 'creating') controller.abort();
    });
    await startImportSession(sessionPreview(), 'test.xlsx', controller.signal, () => {});
    expect(fetch).not.toHaveBeenCalled();
    expect(recoverSession((await importSessionStore.load())!).items[0].status).toBe('unknown');
  });
});
