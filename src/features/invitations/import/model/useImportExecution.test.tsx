// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { createInvitation } from '../../api/invitationService';
import type { Invitation } from '../../model/invitation.types';
import { buildImportPreview } from './buildImportPreview';
import { useImportExecution } from './useImportExecution';

vi.hoisted(() => { vi.stubEnv('VITE_API_BASE_URL', 'https://api.test'); });
vi.mock('../../../../config/firebase', () => ({ auth: { currentUser: null } }));
vi.mock('../../api/invitationService', () => ({ createInvitation: vi.fn() }));
const preview = () => buildImportPreview([{
  row: 2, displayName: 'Familia', knownGuests: [], openSlots: 1, replacementsAllowed: false,
  valid: true, input: { displayName: 'Familia', knownGuests: [], openSlots: 1, replacementsAllowed: false },
}], []);
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.mocked(createInvitation).mockReset(); });

it('guards síncronos rechazan callbacks duplicados incluso antes del siguiente render', async () => {
  let resolve!: (value: Invitation) => void;
  vi.mocked(createInvitation).mockImplementation(() => new Promise(done => { resolve = done; }));
  const { result, rerender } = renderHook(() => useImportExecution(preview()));
  await act(async () => { await result.current.confirm(); });
  expect(createInvitation).not.toHaveBeenCalled();
  act(() => { result.current.open(); result.current.open(); });
  const confirm = result.current.confirm;
  let first!: Promise<void>;
  act(() => { first = confirm(); void confirm(); result.current.open(); });
  expect(createInvitation).toHaveBeenCalledTimes(1);
  act(() => { expect(result.current.reset()).toBe(false); });
  rerender();
  await act(async () => { resolve({ id: 'real', version: 'v1' } as Invitation); await first; });
  await act(async () => { await confirm(); result.current.open(); });
  expect(result.current.phase).toBe('finished');
  expect(createInvitation).toHaveBeenCalledTimes(1);
});

it('no genera claves antes de confirmar; una sesión nueva limpia resultados y usa nuevas claves', async () => {
  const random = vi.spyOn(crypto, 'randomUUID');
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  vi.mocked(createInvitation).mockResolvedValue({ id: 'real', version: 'v1' } as Invitation);
  const { result } = renderHook(() => useImportExecution(preview()));
  act(() => { result.current.open(); });
  expect(random).not.toHaveBeenCalled();
  act(() => { result.current.cancel(); });
  expect(random).not.toHaveBeenCalled();
  act(() => { result.current.open(); });
  await act(async () => { await result.current.confirm(); });
  const key = result.current.items[0].idempotencyKey;
  act(() => { expect(result.current.reset()).toBe(true); });
  expect(result.current.items).toEqual([]);
  expect(random).toHaveBeenCalledTimes(1);
  act(() => { result.current.open(); });
  await act(async () => { await result.current.confirm(); });
  expect(result.current.items[0].idempotencyKey).not.toBe(key);
  expect(random).toHaveBeenCalledTimes(2);
  expect(storage).not.toHaveBeenCalled();
});

it('un generador no disponible falla antes de enviar datos', async () => {
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('unavailable'); });
  const { result } = renderHook(() => useImportExecution(preview()));
  act(() => { result.current.open(); });
  await act(async () => { await result.current.confirm(); });
  expect(result.current.error).toContain('No se enviaron invitaciones');
  expect(result.current.phase).toBe('finished');
  expect(createInvitation).not.toHaveBeenCalled();
});
