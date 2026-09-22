// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportInvitationsPage } from './ImportInvitationsPage';
import { buildImportPreview } from '../import/model/buildImportPreview';
import type { ImportAnalysis, WorkerResult } from '../import/model/import.types';
import { createInvitation } from '../api/invitationService';
import type { Invitation } from '../model/invitation.types';
import { ApiError } from '../../../services/http/apiClient';
import { deferred, installImportBrowser } from '../../../../tests/importTestSupport';
import { importSessionStore, withImportLock } from '../import/storage/importSessionStore';
import { newImportSession } from '../import/model/importSession';

vi.hoisted(() => { vi.stubEnv('VITE_API_BASE_URL', 'https://api.test'); });
vi.mock('../../../config/firebase', () => ({ auth: { currentUser: {} } }));
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
    installImportBrowser();
    vi.mocked(createInvitation).mockReset();
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No debe haber solicitudes de red'); }));
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  const mount = async () => {
    const view = render(<StrictMode><MemoryRouter><ImportInvitationsPage /></MemoryRouter></StrictMode>);
    await waitFor(() => expect(screen.queryByText('Comprobando sesión local…')).toBeNull());
    return view;
  };

  it('habilita importar con preview válido sin enviar datos antes de confirmar', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem');
    await mount();
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
    await mount(); select('primero.xlsx');
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
    await mount(); select();
    await act(async () => { await Promise.resolve(); });
    act(() => FakeWorker.instances[0].reply({ ok: false, message: 'Archivo dañado.' }));
    expect(screen.getByText('Archivo dañado.')).toBeTruthy();
    select();
    expect(screen.queryByText('Archivo dañado.')).toBeNull();
    expect(screen.getByText('Leyendo y validando todo el archivo…')).toBeTruthy();
  });
  it('cancela el Worker al salir y al cambiar de archivo', async () => {
    const view = await mount(); select();
    await act(async () => { await Promise.resolve(); });
    select('otro.xlsx');
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
    view.unmount();
    expect(FakeWorker.instances[1].terminate).toHaveBeenCalledOnce();
  });
  it('no envía al Worker el arrayBuffer de una selección anterior', async () => {
    await mount();
    let finish!: (value: ArrayBuffer) => void;
    select('lento.xlsx', new Promise((resolve) => { finish = resolve; }));
    select('actual.xlsx');
    await act(async () => { finish(new ArrayBuffer(4)); await Promise.resolve(); });
    expect(FakeWorker.instances[0].postMessage).not.toHaveBeenCalled();
    expect(FakeWorker.instances[1].postMessage).toHaveBeenCalledOnce();
  });
  it('termina lecturas agotadas e ignora resultados tardíos', async () => {
    await mount(); vi.useFakeTimers(); select();
    await act(async () => { await Promise.resolve(); });
    act(() => vi.advanceTimersByTime(30_000));
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
    expect(screen.getByText(/La lectura superó 30 segundos/)).toBeTruthy();
    act(() => FakeWorker.instances[0].reply({ ok: true, analysis: analysis() }));
    expect(screen.queryByText('Familia de prueba')).toBeNull();
  });
  it('rechaza extensión diferente sin iniciar lectura', async () => {
    await mount(); select('datos.csv');
    expect(screen.getByText('Selecciona un archivo con extensión .xlsx.')).toBeTruthy();
    expect(FakeWorker.instances).toHaveLength(0);
  });
  async function ready(value = analysis()) {
    select();
    await act(async () => { await Promise.resolve(); });
    act(() => FakeWorker.instances.at(-1)!.reply({ ok: true, analysis: value }));
  }
  it('no permite importar un error global con filas válidas', async () => {
    await mount(); const value = analysis();
    value.valid = false; value.summary.errors = 1;
    value.issues.push({ severity: 'error', sheet: 'Extra', row: 0, column: '', code: 'EXTRA', message: 'Hoja extra' });
    await ready(value);
    expect((screen.getByRole('button', { name: 'Importar invitaciones' }) as HTMLButtonElement).disabled).toBe(true);
    expect(createInvitation).not.toHaveBeenCalled();
  });
  it('advertencias permiten confirmar, muestra cantidades y cancelar no llama API', async () => {
    await mount(); const value = analysis();
    value.issues.push({ severity: 'warning', sheet: 'Invitaciones', row: 2, column: '', code: 'REPEATED', message: 'Nombre repetido' });
    await ready(value);
    fireEvent.click(screen.getByRole('button', { name: 'Importar invitaciones' }));
    expect(screen.getByText('Se crearán 1 invitaciones con 2 cupos en total.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Confirmar importación' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('button', { name: 'Crear invitaciones' })).toBeNull();
    expect(createInvitation).not.toHaveBeenCalled();
  });
  it.each(['finalizar', 'descartar'])('doble confirmación crea una vez y %s oculta el preview consumido', async action => {
    let resolve!: (value: Invitation) => void;
    vi.mocked(createInvitation).mockImplementation(() => new Promise(done => { resolve = done; }));
    const view = await mount(); await ready();
    const start = screen.getByRole('button', { name: 'Importar invitaciones' });
    fireEvent.click(start); fireEvent.click(start);
    const confirm = screen.getByRole('button', { name: 'Crear invitaciones' });
    act(() => { fireEvent.click(confirm); fireEvent.click(confirm); });
    await waitFor(() => expect(createInvitation).toHaveBeenCalledTimes(1));
    const key = vi.mocked(createInvitation).mock.calls[0][1]!.idempotencyKey;
    expect((screen.getByLabelText('Seleccionar archivo XLSX') as HTMLInputElement).disabled).toBe(true);
    expect((start as HTMLButtonElement).disabled).toBe(true);
    select('forzado.xlsx');
    expect(FakeWorker.instances).toHaveLength(1);
    view.rerender(<StrictMode><MemoryRouter><ImportInvitationsPage /></MemoryRouter></StrictMode>);
    expect(createInvitation).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Creando invitación 1 de 1')).toBeTruthy();
    const progress = screen.getByRole('progressbar', { name: 'Progreso de importación' });
    expect(progress.getAttribute('value')).toBe('0');
    expect(progress.getAttribute('max')).toBe('1');
    expect(screen.getByText('Creando invitación 1 de 1').parentElement?.getAttribute('aria-atomic')).toBe('true');
    expect(screen.queryByText(/Sesión recuperada del almacenamiento/)).toBeNull();
    await act(async () => { resolve({ id: 'backend-id', version: 'v1' } as Invitation); });
    await screen.findByText('Importación completada');
    expect(screen.getByText('1 creadas · 0 fallidas · 0 no procesadas · 0 desconocidas')).toBeTruthy();
    expect(progress.getAttribute('value')).toBe('1');
    expect(screen.getByText(/Todas las invitaciones están creadas/)).toBeTruthy();
    expect(screen.queryByText(/Continúa esta sesión/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Ver invitación' }).getAttribute('href')).toBe('/invitaciones/backend-id');
    expect(document.body.textContent).not.toContain(key);
    fireEvent.click(start); expect(createInvitation).toHaveBeenCalledTimes(1);
    select('nuevo.xlsx');
    expect(screen.getByText('Importación completada')).toBeTruthy();
    expect(FakeWorker.instances).toHaveLength(1);
    if (action === 'finalizar') fireEvent.click(screen.getByRole('button', { name: 'Finalizar sesión' }));
    else {
      fireEvent.click(screen.getByRole('button', { name: 'Descartar sesión' }));
      fireEvent.click(screen.getByRole('button', { name: 'Descartar de todas formas' }));
    }
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Ver invitación' })).toBeNull());
    expect(screen.queryByText('Familia de prueba')).toBeNull();
    expect(screen.queryByText(/Archivo válido/)).toBeNull();
    expect(screen.getByText(/Selecciona un archivo nuevo/)).toBeTruthy();
    expect((start as HTMLButtonElement).disabled).toBe(true);
    expect(await importSessionStore.load()).toBeNull();
    expect(createInvitation).toHaveBeenCalledTimes(1);
    select('nuevo.xlsx');
    await act(async () => { await Promise.resolve(); });
    act(() => FakeWorker.instances.at(-1)!.reply({ ok: true, analysis: analysis() }));
    expect(screen.getByText('Familia de prueba')).toBeTruthy();
    expect((start as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText('Importación completada')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Ver invitación' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Crear invitaciones' })).toBeNull();
  });
  it.each([400, 500])('muestra resumen parcial y solo IDs confirmados ante %s', async status => {
    const value = analysis();
    value.invitations = [2, 3, 4].map(row => ({ ...value.invitations[0], row }));
    vi.mocked(createInvitation).mockResolvedValueOnce({ id: 'real', version: 'v1' } as Invitation).mockRejectedValue(new ApiError(status));
    await mount(); await ready(value);
    fireEvent.click(screen.getByRole('button', { name: 'Importar invitaciones' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Crear invitaciones' })); });
    await screen.findByText('Importación detenida');
    expect(screen.getByText(status === 400 ? '1 creadas · 1 fallidas · 1 no procesadas · 0 desconocidas' : '1 creadas · 0 fallidas · 1 no procesadas · 1 desconocidas')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Ver invitación' })).toHaveLength(1);
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('2');
    expect(screen.getByRole('progressbar').getAttribute('max')).toBe('3');
    if (status === 400) {
      expect(screen.getByText(/La importación no puede continuar por un fallo bloqueante/)).toBeTruthy();
      expect(screen.queryByText(/Continúa esta sesión/)).toBeNull();
    } else expect(screen.getByText(/Continúa esta sesión para reconciliar resultados desconocidos/)).toBeTruthy();
    expect(createInvitation).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Descartar sesión' }));
    expect(screen.getByText('Ya se crearon 1 de 3 invitaciones.')).toBeTruthy();
    expect(screen.getByText(/Descartar no eliminará las 1 invitaciones creadas/)).toBeTruthy();
    if (status === 500) expect(screen.getByText(/Algunas invitaciones podrían haberse creado/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect((await importSessionStore.load())!.items[0].invitationId).toBe('real');
    expect(createInvitation).toHaveBeenCalledTimes(2);
  });
  it('desmontar durante creación aborta la petición y no envía la siguiente fila', async () => {
    let resolve!: (value: Invitation) => void;
    vi.mocked(createInvitation).mockImplementation(() => new Promise(done => { resolve = done; }));
    const value = analysis(); value.invitations.push({ ...value.invitations[0], row: 3 });
    const view = await mount(); await ready(value);
    fireEvent.click(screen.getByRole('button', { name: 'Importar invitaciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear invitaciones' }));
    await waitFor(() => expect(createInvitation).toHaveBeenCalledTimes(1));
    view.unmount();
    expect(vi.mocked(createInvitation).mock.calls[0][1]!.signal!.aborted).toBe(true);
    await act(async () => { resolve({ id: 'real' } as Invitation); });
    expect(createInvitation).toHaveBeenCalledTimes(1);
  });
  it('recupera sin POST automático, bloquea nuevo Excel y requiere confirmar descarte', async () => {
    const session = await newImportSession(analysis(), 'recuperado.xlsx');
    session.items[0].status = 'creating';
    await importSessionStore.save(session, true);
    await mount();
    expect(screen.getByText('Hay una importación pendiente')).toBeTruthy();
    expect(screen.getByText(/Sesión recuperada del almacenamiento local/)).toBeTruthy();
    expect(screen.queryByText('Selecciona un archivo para comenzar.')).toBeNull();
    expect(screen.getByText('Fila 2: Familia de prueba — Resultado desconocido')).toBeTruthy();
    expect(createInvitation).not.toHaveBeenCalled();
    select('nuevo.xlsx'); expect(FakeWorker.instances).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Descartar sesión' }));
    expect(await importSessionStore.load()).not.toBeNull();
    expect(screen.getByText(/Volver a importar el mismo archivo podría generar duplicados/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await importSessionStore.load()).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar sesión' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descartar de todas formas' }));
    await waitFor(() => expect(screen.queryByText('Hay una importación pendiente')).toBeNull());
    expect(await importSessionStore.load()).toBeNull(); expect(createInvitation).not.toHaveBeenCalled();
  });
  it('descartar cero creadas exige confirmación y no genera claves ni peticiones', async () => {
    const session = await newImportSession(analysis(), 'pendiente.xlsx'); await importSessionStore.save(session, true);
    const uuid = vi.spyOn(crypto, 'randomUUID');
    await mount(); fireEvent.click(screen.getByRole('button', { name: 'Descartar sesión' }));
    expect(screen.getByText(/Todavía no se ha creado ninguna invitación/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(await importSessionStore.load()).toEqual(session);
    fireEvent.click(screen.getByRole('button', { name: 'Descartar sesión' }));
    fireEvent.click(screen.getByRole('button', { name: /^Descartar$/ }));
    await waitFor(() => expect(screen.queryByText('Hay una importación pendiente')).toBeNull());
    expect(await importSessionStore.load()).toBeNull(); expect(uuid).not.toHaveBeenCalled(); expect(createInvitation).not.toHaveBeenCalled();
  });
  it('descartar una reconciliación rechazada no afirma que ninguna fue creada', async () => {
    const session = await newImportSession(analysis(), 'incierto.xlsx');
    session.items[0] = { ...session.items[0], status: 'failed', errorStatus: 401, mayHaveBeenCreated: true };
    await importSessionStore.save(session, true); await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar sesión' }));
    expect(screen.getByText(/Hay 1 operaciones sin resultado confirmado/)).toBeTruthy();
    expect(screen.getByText(/Descartar elimina las claves necesarias para reconciliarlas/)).toBeTruthy();
    expect(screen.queryByText(/Todavía no se ha creado ninguna/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Descartar de todas formas' })).toBeTruthy();
    expect(createInvitation).not.toHaveBeenCalled();
  });
  it('recupera completed después de refresh y conserva sus IDs hasta finalizar', async () => {
    const session = await newImportSession(analysis(), 'completado.xlsx');
    session.items[0] = { ...session.items[0], status: 'created', invitationId: 'AAA111', version: 'v1' };
    session.status = 'completed'; await importSessionStore.save(session, true);
    await mount();
    expect(screen.getByText('Importación completada')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver invitación' }).getAttribute('href')).toBe('/invitaciones/AAA111');
    expect(createInvitation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Finalizar sesión' }));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Ver invitación' })).toBeNull());
    expect(await importSessionStore.load()).toBeNull();
  });
  it('un fallo de almacenamiento al abrir bloquea selección e importación sin POST', async () => {
    const load = vi.spyOn(importSessionStore, 'load').mockRejectedValue(new Error('storage unavailable'));
    await mount(); select();
    expect(FakeWorker.instances).toHaveLength(0);
    expect((screen.getByRole('button', { name: 'Importar invitaciones' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/No se pudo guardar o leer la sesión local/)).toBeTruthy();
    expect(createInvitation).not.toHaveBeenCalled();
    load.mockRestore(); fireEvent.click(screen.getByRole('button', { name: 'Comprobar sesión local' }));
    await waitFor(() => expect((screen.getByLabelText('Seleccionar archivo XLSX') as HTMLInputElement).disabled).toBe(false));
  });
  it('fallar el guardado final conserva el ID visible y permite guardarlo sin otro POST', async () => {
    const save = importSessionStore.save.bind(importSessionStore); let calls = 0;
    vi.spyOn(importSessionStore, 'save').mockImplementation(async (...args) => {
      if (++calls === 3) throw new Error('quota');
      return save(...args);
    });
    vi.mocked(createInvitation).mockResolvedValue({ id: 'CONFIRMED', version: 'v1' } as Invitation);
    await mount(); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Importar invitaciones' }));
    fireEvent.click(screen.getByRole('button', { name: 'Crear invitaciones' }));
    await screen.findByText('Importación detenida: comprueba la sesión local');
    expect(screen.getByRole('link', { name: 'Ver invitación' }).getAttribute('href')).toBe('/invitaciones/CONFIRMED');
    expect(screen.getAllByText(/No es seguro recargar/).length).toBeGreaterThan(0);
    expect((await importSessionStore.load())!.items[0].status).toBe('creating');
    expect(screen.getByText(/Guarda los resultados locales antes de finalizar/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Finalizar sesión' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar resultados' }));
    await screen.findByText('Importación completada');
    expect(createInvitation).toHaveBeenCalledTimes(1);
    expect((await importSessionStore.load())!.items[0].invitationId).toBe('CONFIRMED');
  });
  it('continuar muestra reconciliación y mantiene exactamente la clave recuperada', async () => {
    const session = await newImportSession(analysis(), 'recuperado.xlsx'); session.items[0].status = 'creating';
    await importSessionStore.save(session, true);
    let resolve!: (value: Invitation) => void;
    vi.mocked(createInvitation).mockImplementation(() => new Promise(done => { resolve = done; }));
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar importación' }));
    await waitFor(() => expect(createInvitation).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Reconciliando resultado con la misma clave…')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toContain('0 de 1 procesadas');
    expect(vi.mocked(createInvitation).mock.calls[0][1]!.idempotencyKey).toBe(session.items[0].idempotencyKey);
    await act(async () => { resolve({ id: 'RECOVERED', version: 'v1' } as Invitation); });
    await screen.findByText('Importación completada');
  });
  it('no descarta si otra pestaña creó invitaciones después de abrir la confirmación', async () => {
    const session = await newImportSession(analysis(), 'test.xlsx');
    await importSessionStore.save(session, true); await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar sesión' }));
    const updated = structuredClone(session);
    updated.items[0] = { ...updated.items[0], status: 'created', invitationId: 'OTHER-TAB' };
    updated.status = 'completed';
    await importSessionStore.save(updated);
    fireEvent.click(screen.getByRole('button', { name: /^Descartar$/ }));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Comprobar sesión local' }) as HTMLButtonElement).disabled).toBe(false));
    expect(await importSessionStore.load()).not.toBeNull();
    expect(createInvitation).not.toHaveBeenCalled();
    expect(screen.getByText(/La sesión avanzó o cambió/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar sesión' }));
    expect(screen.getByText('Ya se crearon 1 de 1 invitaciones.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar de todas formas' }));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Ver invitación' })).toBeNull());
    expect(await importSessionStore.load()).toBeNull();
  });
  it('Comprobar sesión actualiza resultados después de un rechazo por bloqueo de otra pestaña', async () => {
    const session = await newImportSession(analysis(), 'test.xlsx'); await importSessionStore.save(session, true);
    await mount(); const release = deferred<void>(); const entered = deferred<void>();
    const other = withImportLock(async () => { entered.resolve(); await release.promise; });
    await entered.promise;
    fireEvent.click(screen.getByRole('button', { name: 'Continuar importación' }));
    await screen.findByText(/Otra pestaña está usando la importación/);
    const updated = structuredClone(session);
    updated.items[0] = { ...updated.items[0], status: 'created', invitationId: 'OTHER-TAB' }; updated.status = 'completed';
    await importSessionStore.save(updated); release.resolve(); await other;
    fireEvent.click(screen.getByRole('button', { name: 'Comprobar sesión local' }));
    await screen.findByText('Importación completada');
    expect(createInvitation).not.toHaveBeenCalled();
  });
});
