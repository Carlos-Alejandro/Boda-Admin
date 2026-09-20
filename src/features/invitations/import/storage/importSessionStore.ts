import { ImportSessionError, ImportStorageError, validateSession, type ImportSession } from '../model/importSession';

export const SESSION_DB = 'boda-import-session';
const STORE = 'sessions';
const KEY = 'active';
export const STORAGE_ERROR = 'No se pudo guardar o leer la sesión local. Se detuvo la importación. No es seguro recargar ni iniciar otro batch: conserva esta página y vuelve a comprobar el almacenamiento.';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = () => { settled = true; clearTimeout(timer); reject(new ImportStorageError(STORAGE_ERROR)); };
    const timer = setTimeout(fail, 10_000);
    try {
      const request = indexedDB.open(SESSION_DB, 1);
      request.onupgradeneeded = () => { request.result.createObjectStore(STORE); };
      request.onerror = fail;
      request.onblocked = fail;
      request.onsuccess = () => {
        clearTimeout(timer);
        if (settled) { request.result.close(); return; }
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
    } catch { fail(); }
  });
}

// Resolve only on transaction completion, never on individual request success.
async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode, { durability: mode === 'readwrite' ? 'strict' : 'default' });
      let value: T;
      const timer = setTimeout(() => {
        try { tx.abort(); }
        catch { reject(new ImportStorageError(STORAGE_ERROR)); }
      }, 10_000);
      tx.oncomplete = () => { clearTimeout(timer); resolve(value); };
      tx.onabort = () => { clearTimeout(timer); reject(new ImportStorageError(STORAGE_ERROR)); };
      tx.onerror = () => { /* The abort event is the definitive failure. */ };
      if (mode === 'readwrite' && tx.durability !== 'strict') { tx.abort(); return; }
      try { operation(tx.objectStore(STORE), next => { value = next; }); }
      catch { tx.abort(); }
    });
  } catch { throw new ImportStorageError(STORAGE_ERROR); }
  finally { db.close(); }
}

export const importSessionStore = {
  async load(): Promise<ImportSession | null> {
    const value = await transaction<unknown>('readonly', (store, result) => {
      const request = store.get(KEY);
      request.onsuccess = () => result(request.result);
    });
    return value === undefined ? null : validateSession(value);
  },
  async save(session: ImportSession, initial = false): Promise<void> {
    await transaction<void>('readwrite', (store, result) => {
      const request = store.get(KEY);
      request.onsuccess = () => {
        // Never overwrite a different session or resurrect a deleted session.
        if (initial ? request.result !== undefined : request.result?.id !== session.id) { store.transaction.abort(); return; }
        store.put(session, KEY);
        result(undefined);
      };
    });
  },
  async remove(id: string): Promise<void> {
    await transaction<void>('readwrite', (store, result) => {
      const request = store.get(KEY);
      request.onsuccess = () => {
        if (request.result?.id !== id) { store.transaction.abort(); return; }
        store.delete(KEY); result(undefined);
      };
    });
  },
};

export async function withImportLock<T>(action: () => Promise<T>): Promise<T> {
  if (!globalThis.navigator?.locks?.request) {
    throw new ImportSessionError('Este navegador no permite bloquear la importación entre pestañas. Usa un navegador moderno en HTTPS; no se enviarán invitaciones.');
  }
  return navigator.locks.request('boda-import-session:v1', { mode: 'exclusive', ifAvailable: true }, async lock => {
    if (!lock) throw new ImportSessionError('Otra pestaña está usando la importación. Espera a que termine y pulsa Comprobar sesión local.');
    return action();
  });
}
