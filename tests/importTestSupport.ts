import { webcrypto } from 'node:crypto';
import { IDBFactory } from 'fake-indexeddb';
import { vi } from 'vitest';
import { buildImportPreview } from '../src/features/invitations/import/model/buildImportPreview';

export function installImportBrowser() {
  vi.stubGlobal('indexedDB', new IDBFactory());
  vi.stubGlobal('crypto', webcrypto);
  const held = new Set<string>();
  const locks = { request: vi.fn(async (name: string, _options: unknown, callback: (lock: object | null) => Promise<unknown>) => {
    if (held.has(name)) return callback(null);
    held.add(name);
    try { return await callback({ name }); }
    finally { held.delete(name); }
  }) };
  vi.stubGlobal('navigator', { locks });
  return locks;
}

export const sessionPreview = (rows = [2, 3, 4]) => buildImportPreview(rows.map(row => ({
  row, displayName: `Familia ${row}`, knownGuests: [{ name: 'B', row, column: 4 }, { name: 'A', row, column: 5 }],
  openSlots: 1, replacementsAllowed: true, valid: true,
  input: { displayName: `Familia ${row}`, knownGuests: [{ name: 'B' }, { name: 'A' }], openSlots: 1, replacementsAllowed: true },
})), []);

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
