import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { utils, write } from 'xlsx';
import { readWorkbook } from './readWorkbook';
import { validateWorkbook } from '../model/validateWorkbook';
import { FIXED_HEADERS } from '../model/validateWorkbook';

function binary(options: { formula?: boolean; guestFormula?: boolean; date?: boolean; hidden?: boolean; bookType?: 'xlsx' | 'xlsb' | 'xlsm' } = {}) {
  const book = utils.book_new();
  const invitations = utils.aoa_to_sheet([[...FIXED_HEADERS, 'Invitado 1'], ['Familia', options.date ? new Date(2026, 0, 1) : 1, true, 'José']]);
  if (options.formula) invitations.B2 = { t: 'n', v: 1, f: '1+0' };
  if (options.guestFormula) invitations.D2 = { t: 's', v: 'José', f: '"José"' };
  if (options.hidden) invitations['!rows'] = [{}, { hidden: true }];
  utils.book_append_sheet(book, invitations, 'Invitaciones');
  return write(book, { type: 'array', bookType: options.bookType ?? 'xlsx', compression: true }) as ArrayBuffer;
}

describe('adaptador XLSX real', () => {
  it.each([
    ['A2', 'Invitación'], ['B2', 'Espacios abiertos'],
    ['C2', 'Permitir sustituciones'], ['D2', 'Invitado 1'], ['D1', 'Invitado 1'],
  ])('conserva y rechaza fórmula sin resultado calculado en %s', (address, field) => {
    const book = utils.book_new();
    const sheet = utils.aoa_to_sheet([[...FIXED_HEADERS, 'Invitado 1'], ['Familia', 1, true, 'José']]);
    sheet[address] = { t: 's', f: 'CHAR(65)' };
    utils.book_append_sheet(book, sheet, 'Invitaciones');
    const workbook = readWorkbook(write(book, { type: 'array', bookType: 'xlsx', compression: true }));
    const result = validateWorkbook(workbook);
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'FORMULA', row: address === 'D1' ? 1 : 2 }));
    if (address !== 'D1') expect(result.issues).toContainEqual(expect.objectContaining({ code: 'FORMULA', column: field }));
    expect(result.invitations[0].input).toBeNull();
  });
  it('preservar celdas sin resultado no convierte vacíos finales en personas', () => {
    const book = utils.book_new();
    const sheet = utils.aoa_to_sheet([[...FIXED_HEADERS, 'Invitado 1', 'Invitado 2'], ['Familia', 0, true, 'José', null], [null]], { sheetStubs: true });
    utils.book_append_sheet(book, sheet, 'Invitaciones');
    const result = validateWorkbook(readWorkbook(write(book, { type: 'array', bookType: 'xlsx' })));
    expect(result.valid).toBe(true);
    expect(result.summary).toMatchObject({ invitations: 1, identifiedPeople: '1', totalSlots: '1' });
  });
  it('lee una sola hoja de datos y booleanos sin convertirlos a texto', () => {
    const result = validateWorkbook(readWorkbook(binary()));
    expect(result.valid).toBe(true);
    expect(result.invitations[0].input?.replacementsAllowed).toBe(true);
  });
  it('conserva fórmulas originales con resultado en caché', () => {
    const result = validateWorkbook(readWorkbook(binary({ formula: true })));
    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'FORMULA', row: 2, column: 'Espacios abiertos' }));
  });
  it('no admite fechas como espacios', () => expect(validateWorkbook(readWorkbook(binary({ date: true }))).valid).toBe(false));
  it('rechaza fórmula de nombre original con texto calculado', () => {
    const result = validateWorkbook(readWorkbook(binary({ guestFormula: true })));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'FORMULA', sheet: 'Invitaciones', column: 'Invitado 1', row: 2 }));
    expect(result.invitations[0].input).toBeNull();
  });
  it('incluye filas ocultas', () => expect(validateWorkbook(readWorkbook(binary({ hidden: true }))).summary.invitations).toBe(1));
  it.each(['', 'no es un excel', 'Invitación,Espacios abiertos\nFamilia,1'])('rechaza archivo inválido %s', (text) => expect(() => readWorkbook(new TextEncoder().encode(text).buffer)).toThrow(/XLSX/));
  it('rechaza archivo truncado', () => expect(() => readWorkbook(binary().slice(0, 100))).toThrow(/dañado/));
  it.each(['xlsb', 'xlsm'] as const)('rechaza %s aunque sea renombrado', (bookType) => expect(() => readWorkbook(binary({ bookType }))).toThrow(/XLSX/));
  it('inspecciona tamaño descomprimido declarado antes de leer', () => {
    const data = binary(); const view = new DataView(data);
    for (let offset = 0; offset < data.byteLength - 46; offset++) {
      if (view.getUint32(offset, true) === 0x02014b50) { view.setUint32(offset + 24, 200 * 1024 * 1024, true); break; }
    }
    expect(() => readWorkbook(data)).toThrow(/128 MiB/);
  });
  it('plantilla descargable tiene únicamente encabezados en hojas importables', () => {
    const file = readFileSync('public/templates/plantilla-invitaciones-v1.xlsx');
    const workbook = readWorkbook(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(['Instrucciones', 'Invitaciones']);
    for (const sheet of workbook.sheets.filter((sheet) => sheet.name !== 'Instrucciones')) {
      expect(sheet.mergedCells).toEqual([]);
      expect(sheet.rows[0].cells.map((cell) => cell.value)).toEqual([...FIXED_HEADERS, ...Array.from({ length: 10 }, (_, index) => `Invitado ${index + 1}`)]);
      expect(sheet.rows.slice(1).every((row) => row.cells.every((cell) => cell.value == null && !cell.formula))).toBe(true);
    }
    expect(validateWorkbook(workbook).issues.map((issue) => issue.code)).toEqual(['EMPTY_IMPORT']);
    expect(validateWorkbook(workbook).summary.invitations).toBe(0);
    const instructions = workbook.sheets[0].rows.flatMap((row) => row.cells.map((cell) => cell.value));
    expect(instructions).toContain('Ejemplo de cómo llenar la plantilla');
    expect(instructions).toContain('Sí permite reemplazar a una persona invitada cuando corresponda; No lo impide.');
  });
  it('la plantilla completada pasa por el lector y validador reales sin importar el ejemplo', async () => {
    const copy = new ExcelJS.Workbook();
    await copy.xlsx.readFile('public/templates/plantilla-invitaciones-v1.xlsx');
    const sheet = copy.getWorksheet('Invitaciones');
    expect(sheet).toBeDefined();
    sheet!.getRow(2).values = ['Familia Martínez', 1, 'Sí', 'Carlos Martínez', 'María López'];
    const data = Uint8Array.from(await copy.xlsx.writeBuffer() as unknown as Uint8Array);
    const workbook = readWorkbook(data.buffer);
    const result = validateWorkbook(workbook);
    expect(result.valid).toBe(true);
    expect(result.summary).toMatchObject({ invitations: 1, identifiedPeople: '2', openSlots: '1', totalSlots: '3' });
    expect(result.invitations[0].input).toEqual({
      displayName: 'Familia Martínez', openSlots: 1, replacementsAllowed: true,
      knownGuests: [{ name: 'Carlos Martínez' }, { name: 'María López' }],
    });
  });
});
