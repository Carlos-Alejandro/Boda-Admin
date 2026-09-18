// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportInvitationsPage } from './ImportInvitationsPage';
import { buildImportPreview } from '../import/model/buildImportPreview';
import type { ImportAnalysis, WorkerResult } from '../import/model/import.types';

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

describe('página de vista previa, sin creación', () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No debe haber solicitudes de red'); }));
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  const mount = () => render(<StrictMode><MemoryRouter><ImportInvitationsPage /></MemoryRouter></StrictMode>);

  it('muestra estado vacío, lectura, preview válido y botón siempre deshabilitado, sin fetch', async () => {
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
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(fetch).not.toHaveBeenCalled();
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
});
