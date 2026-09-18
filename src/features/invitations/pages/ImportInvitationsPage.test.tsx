// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportInvitationsPage } from './ImportInvitationsPage';
import { buildImportPreview } from '../import/model/buildImportPreview';
import type { ImportAnalysis, WorkerResult } from '../import/model/import.types';
import { createInvitation } from '../api/invitationService';
import type { Invitation } from '../model/invitation.types';
import { ApiError } from '../../../services/http/apiClient';

vi.hoisted(() => { vi.stubEnv('VITE_API_BASE_URL', 'https://api.test'); });
vi.mock('../../../config/firebase', () => ({ auth: { currentUser: null } }));
vi.mock('../api/invitationService', () => ({ createInvitation: vi.fn() }));

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: WorkerResult }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() { FakeWorker.instances.push(this); }
  reply(data: WorkerResult) { this.onmessage?.({ data }); }
}
const analysis = (): ImportAnalysis => buildImportPreview([{
  row: 2, displayName: 'Familia de prueba', knownGuests: [{ name: 'Persona de prueba', row: 2, column: 4 }],
  openSlots: 1, replacementsAllowed: true, valid: true,
  input: { displayName: 'Familia de prueba', knownGuests: [{ name: 'Persona de prueba' }], openSlots: 1, replacementsAllowed: true },
}], []);

function select(name = 'invitaciones.xlsx', data = Promise.resolve(new ArrayBuffer(4))) {
  const file = new File(['test'], name);
  Object.defineProperty(file, 'arrayBuffer', { value: () => data });
  fireEvent.change(screen.getByLabelText('Seleccionar archivo XLSX'), { target: { files: [file] } });
}

describe('vista previa y creación confirmada', () => {
  beforeEach(() => {
    vi.mocked(createInvitation).mockReset();
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No debe haber solicitudes de red'); }));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  const mount = () => render(<StrictMode><MemoryRouter><ImportInvitationsPage /></MemoryRouter></StrictMode>);

  it('habilita importar con preview válido sin enviar datos antes de confirmar', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    mount();
    expect(screen.getByText('Selecciona un archivo para comenzar.')).toBeTruthy();
    select();
    expect(screen.getByText('Leyendo y validando todo el archivo…')).toBeTruthy();
    await act(async () => { await Promise.resolve(); });
    expect(FakeWorker.instances[0].postMessage).toHaveBeenCalledOnce();
    act(() => FakeWorker.instances[0].reply({ ok: true, analysis: analysis() }));
    expect(screen.getByText('Familia de prueba')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Importar invitaciones' }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(fetch).not.toHaveBeenCalled();
    expect(createInvitation).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    storage.mockRestore();
  });
  it('reemplaza errores y vista previa al seleccionar otro archivo y descarta resultados atrasados', async () => {
    mount(); select('primero.xlsx');
    await act(async () => { await Promise.resolve(); });
    const old = FakeWorker.instances[0];
    const invalid = buildImportPreview([], [{ severity: 'error', sheet: 'Invitaciones', row: 6, column: 'Invitado 1', code: 'INVALID_VALUE', message: 'Falta el nombre de la persona.' }]);
    act(() => old.reply({ ok: true, analysis: invalid }));
    expect(screen.getByText('Falta el nombre de la persona.')).toBeTruthy();
    select('segundo.xlsx');
    expect(screen.queryByText('Falta el nombre de la persona.')).toBeNull();
    act(() => old.reply({ ok: true, analysis: analysis() }));
    expect(screen.queryByText('Familia de prueba')).toBeNull();
    await act(async () => { await Promise.resolve(); });
    act(() => FakeWorker.instances[1].reply({ ok: true, analysis: analysis() }));
    expect(screen.getByText('Familia de prueba')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('permite volver a seleccionar después de un archivo corrupto', async () => {
    mount(); select();
    await act(async () => { await Promise.resolve(); });
    act(() => FakeWorker.instances[0].reply({ ok: false, message: 'Archivo dañado.' }));
    expect(screen.getByText('Archivo dañado.')).toBeTruthy();
    select();
    expect(screen.queryByText('Archivo dañado.')).toBeNull();
    expect(screen.getByText('Leyendo y validando todo el archivo…')).toBeTruthy();
  });
  it('cancela el Worker al salir y al cambiar de archivo', async () => {
    const view = mount(); select();
    await act(async () => { await Promise.resolve(); });
    select('otro.xlsx');
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
    view.unmount();
    expect(FakeWorker.instances[1].terminate).toHaveBeenCalledOnce();
  });
  it('no envía al Worker el arrayBuffer de una selección anterior', async () => {
    mount();
    let finish!: (value: ArrayBuffer) => void;
    select('lento.xlsx', new Promise((resolve) => { finish = resolve; }));
    select('actual.xlsx');
    await act(async () => { finish(new ArrayBuffer(4)); await Promise.resolve(); });
    expect(FakeWorker.instances[0].postMessage).not.toHaveBeenCalled();
    expect(FakeWorker.instances[1].postMessage).toHaveBeenCalledOnce();
  });
  it('termina lecturas agotadas e ignora resultados tardíos', async () => {
    vi.useFakeTimers(); mount(); select();
    await act(async () => { await Promise.resolve(); });
    act(() => vi.advanceTimersByTime(30_000));
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
    expect(screen.getByText(/La lectura superó 30 segundos/)).toBeTruthy();
    act(() => FakeWorker.instances[0].reply({ ok: true, analysis: analysis() }));
    expect(screen.queryByText('Familia de prueba')).toBeNull();
  });
  it('rechaza extensión diferente sin iniciar lectura', () => {
    mount(); select('datos.csv');
    expect(screen.getByText('Selecciona un archivo con extensión .xlsx.')).toBeTruthy();
    expect(FakeWorker.instances).toHaveLength(0);
  });
  async function ready(value = analysis()) {
    select();
    await act(async () => { await Promise.resolve(); });
    act(() => FakeWorker.instances.at(-1)!.reply({ ok: true, analysis: value }));
  }
  it('no permite importar un error global con filas válidas', async () => {
    mount(); const value = analysis();
    value.valid = false; value.summary.errors = 1;
    value.issues.push({ severity: 'error', sheet: 'Extra', row: 0, column: '', code: 'EXTRA', message: 'Hoja extra' });
    await ready(value);
    expect((screen.getByRole('button', { name: 'Importar invitaciones' }) as HTMLButtonElement).disabled).toBe(true);
    expect(createInvitation).not.toHaveBeenCalled();
  });
  it('advertencias permiten confirmar, muestra cantidades y cancelar no llama API', async () => {
    mount(); const value = analysis();
    value.issues.push({ severity: 'warning', sheet: 'Invitaciones', row: 2, column: '', code: 'REPEATED', message: 'Nombre repetido' });
    await ready(value);
    fireEvent.click(screen.getByRole('button', { name: 'Importar invitaciones' }));
    expect(screen.getByText('Se crearán 1 invitaciones con 2 cupos en total.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Confirmar importación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('button', { name: 'Crear invitaciones' })).toBeNull();
    expect(createInvitation).not.toHaveBeenCalled();
  });
  it('doble confirmación y rerender crean una vez; bloquea selector, conserva clave y limpia al cambiar archivo', async () => {
    let resolve!: (value: Invitation) => void;
    vi.mocked(createInvitation).mockImplementation(() => new Promise(done => { resolve = done; }));
    const view = mount(); await ready();
    const start = screen.getByRole('button', { name: 'Importar invitaciones' });
    fireEvent.click(start); fireEvent.click(start);
    const confirm = screen.getByRole('button', { name: 'Crear invitaciones' });
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm); });
    expect(createInvitation).toHaveBeenCalledTimes(1);
    const key = vi.mocked(createInvitation).mock.calls[0][1]!.idempotencyKey;
    expect((screen.getByLabelText('Seleccionar archivo XLSX') as HTMLInputElement).disabled).toBe(true);
    expect((start as HTMLButtonElement).disabled).toBe(true);
    select('forzado.xlsx');
    expect(FakeWorker.instances).toHaveLength(1);
    view.rerender(<StrictMode><MemoryRouter><ImportInvitationsPage /></MemoryRouter></StrictMode>);
    expect(createInvitation).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Creando invitación 1 de 1')).toBeTruthy();
    await act(async () => { resolve({ id: 'backend-id', version: 'v1' } as Invitation); });
    expect(screen.getByText('Importación completada')).toBeTruthy();
    expect(screen.getByText('1 creadas · 0 fallidas · 0 no procesadas · 0 desconocidas')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver invitación' }).getAttribute('href')).toBe('/invitaciones/backend-id');
    expect(document.body.textContent).not.toContain(key);
    fireEvent.click(start); expect(createInvitation).toHaveBeenCalledTimes(1);
    select('nuevo.xlsx');
    expect(screen.queryByText('Importación completada')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ver invitación' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Crear invitaciones' })).toBeNull();
  });
  it.each([400, 500])('muestra resumen parcial y solo IDs confirmados ante %s', async status => {
    const value = analysis();
    value.invitations = [2, 3, 4].map(row => ({ ...value.invitations[0], row }));
    vi.mocked(createInvitation).mockResolvedValueOnce({ id: 'real', version: 'v1' } as Invitation).mockRejectedValue(new ApiError(status));
    mount(); await ready(value);
    fireEvent.click(screen.getByRole('button', { name: 'Importar invitaciones' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Crear invitaciones' })); });
    expect(screen.getByText('Importación detenida')).toBeTruthy();
    expect(screen.getByText(status === 400 ? '1 creadas · 1 fallidas · 1 no procesadas · 0 desconocidas' : '1 creadas · 0 fallidas · 1 no procesadas · 1 desconocidas')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Ver invitación' })).toHaveLength(1);
    expect(createInvitation).toHaveBeenCalledTimes(2);
  });
  it('desmontar durante creación aborta la petición y no envía la siguiente fila', async () => {
    let resolve!: (value: Invitation) => void;
    vi.mocked(createInvitation).mockImplementation(() => new Promise(done => { resolve = done; }));
    const value = analysis(); value.invitations.push({ ...value.invitations[0], row: 3 });
    const view = mount(); await ready(value);
    fireEvent.click(screen.getByRole('button', { name: 'Importar invitaciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear invitaciones' }));
    view.unmount();
    expect(vi.mocked(createInvitation).mock.calls[0][1]!.signal!.aborted).toBe(true);
    await act(async () => { resolve({ id: 'real' } as Invitation); });
    expect(createInvitation).toHaveBeenCalledTimes(1);
  });
});
