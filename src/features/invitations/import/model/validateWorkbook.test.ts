import { describe, expect, it } from 'vitest';
import type { ImportWorkbook } from './import.types';
import { FIXED_HEADERS, validateWorkbook } from './validateWorkbook';

function fixture(rows: unknown[][] = [['Familia', 0, 'Sí', 'José']]): ImportWorkbook {
  const guestCount = rows.reduce((count, row) => Math.max(count, row.length - 3), 1);
  const headers = [...FIXED_HEADERS, ...Array.from({ length: guestCount }, (_, index) => `Invitado ${index + 1}`)];
  return { sheets: [{ name: 'Invitaciones', mergedCells: [], rows: [headers, ...rows].map((cells, index) => ({
    row: index + 1, cells: cells.map((value, column) => ({ column: column + 1, value })),
  })) }] };
}
const codes = (book: ImportWorkbook) => validateWorkbook(book).issues.map((issue) => issue.code);

describe('invitaciones completas por fila, sin identificadores manuales', () => {
  it('A: una fila produce 1 invitación, 3 personas, 1 espacio y 4 cupos', () => {
    const result = validateWorkbook(fixture([['Familia Martínez', 1, 'Sí', 'Carlos', 'América', 'María']]));
    expect(result.valid).toBe(true);
    expect(result.summary).toMatchObject({ invitations: 1, identifiedPeople: '3', openSlots: '1', totalSlots: '4' });
    expect(result.invitations[0].input).toEqual({ displayName: 'Familia Martínez', openSlots: 1, replacementsAllowed: true, knownGuests: [{ name: 'Carlos' }, { name: 'América' }, { name: 'María' }] });
    expect(result.invitations[0]).not.toHaveProperty('code');
    expect(result.invitations[0]).not.toHaveProperty('id');
  });
  it('B: ignora vacíos finales', () => {
    const result = validateWorkbook(fixture([['Julia & Jordi', 0, 'No', 'Julia', 'Jordi', '', null, '  ']]));
    expect(result.valid).toBe(true); expect(result.summary.identifiedPeople).toBe('2');
  });
  it('C: huecos internos invalidan solamente su fila', () => {
    const result = validateWorkbook(fixture([['Familia', 0, 'Sí', 'Carlos', '', 'América'], ['Otra', 1, 'No']]));
    expect(result.issues).toContainEqual(expect.objectContaining({ sheet: 'Invitaciones', row: 2, column: 'Invitado 2', code: 'GUEST_GAP' }));
    expect(result.invitations[0].input).toBeNull();
    expect(result.invitations[1].valid).toBe(true);
    expect(result.valid).toBe(false);
  });
  it.each([
    ['Invitado 1', 'Invitado 3'], ['Invitado 2', 'Invitado 3'], ['Invitado A'],
    ['Invitado 1', 'Invitado 1'], ['Invitado 01'], ['Invitado 0'],
    ['Invitado 2', 'Invitado 1'], ['Invitado 1', '', 'Invitado 3'],
    ['Invitado 1', 'Invitado 999999999999999999999'],
  ])('D: rechaza encabezados %j', (...headers) => {
    const book = fixture();
    book.sheets[0].rows[0].cells = [...FIXED_HEADERS, ...headers].map((value, index) => ({ column: index + 1, value }));
    const result = validateWorkbook(book);
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.row === 1 && issue.severity === 'error')).toBe(true);
  });
  it.each([12, 50, 2500])('E: acepta %i personas sin límite de diez y conserva el orden', (count) => {
    const names = Array.from({ length: count }, (_, index) => `Persona ${index + 1}`);
    const result = validateWorkbook(fixture([['Familia', 0, 'Sí', ...names]]));
    expect(result.valid).toBe(true);
    expect(result.summary.identifiedPeople).toBe(String(count));
    expect(result.invitations[0].input?.knownGuests.map(({ name }) => name)).toEqual(names);
  });
  it('F: nombres de invitación iguales son filas independientes, sin advertencia por solo el nombre', () => {
    const result = validateWorkbook(fixture([['Familia Martínez', 0, 'Sí', 'Carlos'], ['Familia Martínez', 0, 'Sí', 'América']]));
    expect(result.valid).toBe(true); expect(result.summary.invitations).toBe(2);
    expect(result.issues).toEqual([]);
    expect(result.invitations.map((item) => item.input?.knownGuests)).toEqual([[{ name: 'Carlos' }], [{ name: 'América' }]]);
  });
  it('contenido idéntico advierte sin fusionar ni bloquear', () => {
    const result = validateWorkbook(fixture([['Familia', 0, 'Sí', 'José', 'María'], ['Familia', 0, true, 'María', 'José']]));
    expect(result.valid).toBe(true); expect(result.summary.invitations).toBe(2);
    expect(result.issues[0]).toMatchObject({ severity: 'warning', code: 'IDENTICAL_INVITATION', row: 3 });
  });
  it.each([0, 1, 2, 3])('G/H: fórmula con caché en columna %i', (column) => {
    const book = fixture(); book.sheets[0].rows[1].cells[column].formula = true;
    expect(codes(book)).toContain('FORMULA');
    expect(validateWorkbook(book).invitations[0].input).toBeNull();
  });
  it('fórmula sin resultado posterior a vacíos también se valida', () => {
    const book = fixture([['Familia', 1, 'No', 'Carlos', '', '']]);
    book.sheets[0].rows[1].cells[5].formula = true;
    expect(codes(book)).toEqual(expect.arrayContaining(['FORMULA', 'GUEST_GAP']));
  });
  it('I: conserva acentos, ñ, apellidos, puntuación y espacios interiores', () => {
    const names = ['América Hernández', 'José María Pérez', 'María José', 'Zoé Muñoz, Jr.', 'María-José', 'Ana  Pérez'];
    const result = validateWorkbook(fixture([[' Familia ', 0, 'Sí', ...names.map((name) => ` ${name} `)]]));
    expect(result.invitations[0].input?.knownGuests.map(({ name }) => name)).toEqual(names);
    expect(result.invitations[0].input?.displayName).toBe('Familia');
  });
  it('J: mantiene 3 invitaciones / 7 personas / 2 espacios / 9 cupos', () => {
    const result = validateWorkbook(fixture([
      ['Familia Martínez', 1, 'Sí', 'Carlos Manuel', 'América Hernández', 'María Martínez'],
      ['Julia & Jordi', 0, 'No', 'Julia Pérez', 'Jordi López'],
      ['Cassandra & Carlos', 1, 'Sí', 'Cassandra Hernández', 'Carlos Martínez'],
    ]));
    expect(result.valid).toBe(true);
    expect(result.summary).toEqual({ invitations: 3, identifiedPeople: '7', openSlots: '2', totalSlots: '9', validInvitations: 3, invalidInvitations: 0, errors: 0, warnings: 0 });
  });
  it('K: admite Instrucciones e Invitaciones, sin otra hoja requerida', () => {
    const book = fixture(); book.sheets.unshift({ name: 'Instrucciones', rows: [], mergedCells: [] });
    expect(validateWorkbook(book).valid).toBe(true);
  });
  it('L: requiere Invitaciones', () => expect(codes({ sheets: [] })).toContain('MISSING_SHEET'));
  it.each(['Invitados', 'Otra'])('M: rechaza hoja extra %s sin ignorarla silenciosamente', (name) => {
    const book = fixture(); book.sheets.push({ name, rows: [], mergedCells: [] });
    expect(codes(book)).toContain('UNKNOWN_SHEET'); expect(validateWorkbook(book).valid).toBe(false);
  });
  it.each(['Código', 'Código de invitación', 'Nombre'])('rechaza encabezado obsoleto %s', (name) => {
    const book = fixture(); book.sheets[0].rows[0].cells.push({ column: 5, value: name });
    expect(codes(book)).toContain('UNKNOWN_HEADER');
  });
  it('encabezados faltantes y duplicados', () => {
    const book = fixture(); book.sheets[0].rows[0].cells[1].value = 'Invitación';
    expect(codes(book)).toEqual(expect.arrayContaining(['MISSING_HEADER', 'DUPLICATE_HEADER']));
  });
  it('exige las tres columnas fijas primero y en el orden de la plantilla', () => {
    const book = fixture();
    for (const row of book.sheets[0].rows) for (const cell of row.cells) if (cell.column <= 2) cell.column = 3 - cell.column;
    expect(codes(book)).toContain('HEADER_POSITION');
  });
  it('requiere Invitado 1 aunque no haya personas', () => {
    const book = fixture([['Familia', 1, 'No']]); book.sheets[0].rows[0].cells.pop();
    expect(codes(book)).toContain('MISSING_HEADER');
  });
  it.each(['', ' ', null, 42, true])('rechaza nombre de invitación %s', (name) => {
    expect(validateWorkbook(fixture([[name, 1, 'Sí']])).valid).toBe(false);
  });
  it.each([0, 8, '0', ' 12 '])('acepta espacios %s', (value) => expect(validateWorkbook(fixture([['Familia', value, 'Sí', 'José']])).valid).toBe(true));
  it.each([-1, 1.2, '', ' ', null, true, false, new Date(), '1.2', '1e3', 'abc', Number.MAX_SAFE_INTEGER + 1])('rechaza espacios %s', (value) => expect(validateWorkbook(fixture([['Familia', value, 'Sí', 'José']])).valid).toBe(false));
  it.each(['Sí', 'Si', 'sÍ', ' SI ', true])('acepta sustituciones verdaderas %s', (value) => expect(validateWorkbook(fixture([['Familia', 1, value]])).invitations[0].input?.replacementsAllowed).toBe(true));
  it.each(['No', 'NO', false])('acepta sustituciones falsas %s', (value) => expect(validateWorkbook(fixture([['Familia', 1, value]])).invitations[0].input?.replacementsAllowed).toBe(false));
  it.each(['', null, 'true', 1])('rechaza sustituciones %s', (value) => expect(validateWorkbook(fixture([['Familia', 1, value]])).valid).toBe(false));
  it('ignora filas vacías conservando número real', () => {
    const result = validateWorkbook(fixture([[], [], ['Familia', 1, 'Sí', '', 'José']]));
    expect(result.invitations[0].row).toBe(4);
    expect(result.issues).toContainEqual(expect.objectContaining({ row: 4, column: 'Invitado 1', code: 'GUEST_GAP' }));
  });
  it('acepta solo espacios abiertos y nombres vacíos', () => expect(validateWorkbook(fixture([['Familia', 1, 'No', '', null]])).valid).toBe(true));
  it('rechaza capacidad cero', () => expect(codes(fixture([['Familia', 0, 'No']]))).toContain('INVALID_CAPACITY'));
  it('tres personas más dos espacios dan cinco cupos', () => expect(validateWorkbook(fixture([['Familia', 2, 'No', 'Carlos', 'América', 'María']])).summary.totalSlots).toBe('5'));
  it.each([42, true, new Date(), { unexpected: 'value' }])('rechaza nombre de persona no textual %s', (value) => expect(codes(fixture([['Familia', 1, 'No', value]]))).toContain('INVALID_VALUE'));
  it('nombres duplicados advierten sin eliminar ni bloquear', () => {
    const result = validateWorkbook(fixture([['Familia', 0, 'Sí', 'José', 'José']]));
    expect(result.valid).toBe(true); expect(result.summary.identifiedPeople).toBe('2');
    expect(result.issues[0]).toMatchObject({ severity: 'warning', code: 'DUPLICATE_NAME' });
  });
  it('rechaza columnas desconocidas con contenido', () => {
    const book = fixture(); book.sheets[0].rows[1].cells.push({ column: 7, value: 'dato' });
    expect(codes(book)).toContain('UNKNOWN_COLUMN'); expect(validateWorkbook(book).invitations[0].input).toBeNull();
  });
  it('rechaza celdas combinadas', () => {
    const book = fixture(); book.sheets[0].mergedCells.push({ row: 2, column: 1 });
    expect(codes(book)).toContain('MERGED_CELLS');
  });
  it('detecta plantilla todavía vacía', () => expect(codes(fixture([]))).toEqual(['EMPTY_IMPORT']));
  it('agrega totales exactos sin límite global, comprobando precisión por payload', () => {
    const result = validateWorkbook(fixture([['Uno', Number.MAX_SAFE_INTEGER, 'No'], ['Dos', Number.MAX_SAFE_INTEGER, 'No']]));
    expect(result.valid).toBe(true); expect(result.summary.totalSlots).toBe('18014398509481982');
    expect(codes(fixture([['Uno', Number.MAX_SAFE_INTEGER, 'No', 'José']]))).toContain('INVALID_CAPACITY');
  });
});
