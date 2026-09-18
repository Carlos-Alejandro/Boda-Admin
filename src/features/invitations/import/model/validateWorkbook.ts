import { buildImportPreview } from './buildImportPreview';
import type { ImportCell, ImportIssue, ImportWorkbook, InvitationPreview } from './import.types';
import { hasContent, openSlotsValue, replacementsValue, textValue } from './normalize';

export const FIXED_HEADERS = ['Invitación', 'Espacios abiertos', 'Permitir sustituciones'] as const;
const isGuestHeader = (name: string) => /^Invitado [1-9]\d*$/.test(name);

export function validateWorkbook(workbook: ImportWorkbook) {
  const issues: ImportIssue[] = [];
  const errorRows = new Set<number>();
  let structureValid = true;
  const add = (row: number, column: string, code: string, message: string, severity: ImportIssue['severity'] = 'error', sheet = 'Invitaciones') => {
    issues.push({ severity, sheet, row, column, code, message });
    if (severity === 'error' && sheet === 'Invitaciones') errorRows.add(row);
  };
  for (const sheet of workbook.sheets) {
    if (sheet.name !== 'Invitaciones' && sheet.name !== 'Instrucciones') {
      add(1, 'Hoja', 'UNKNOWN_SHEET', 'Hoja no admitida. Usa únicamente Invitaciones y, opcionalmente, Instrucciones.', 'error', sheet.name);
    }
  }
  const dataSheets = workbook.sheets.filter((sheet) => sheet.name === 'Invitaciones');
  if (dataSheets.length === 0) {
    add(1, 'Hoja', 'MISSING_SHEET', 'Falta la hoja Invitaciones.');
    return buildImportPreview([], issues);
  }
  if (dataSheets.length > 1) {
    structureValid = false;
    add(1, 'Hoja', 'DUPLICATE_SHEET', 'La hoja Invitaciones está repetida.');
  }
  const sheet = dataSheets[0];
  const columns = new Map<string, number>();
  const header = sheet.rows.find((row) => row.row === 1);
  for (const cell of header?.cells ?? []) {
    if (!hasContent(cell)) continue;
    const name = textValue(cell);
    if (cell.formula) add(1, `Columna ${cell.column}`, 'FORMULA', 'Pega el valor del encabezado, no una fórmula.');
    if (!name || (!(FIXED_HEADERS as readonly string[]).includes(name) && !isGuestHeader(name))) {
      structureValid = false;
      add(1, `Columna ${cell.column}`, 'UNKNOWN_HEADER', 'Encabezado desconocido. Usa los nombres exactos de la plantilla.');
    } else if (columns.has(name)) {
      structureValid = false;
      add(1, name, 'DUPLICATE_HEADER', 'El encabezado está repetido.');
    } else columns.set(name, cell.column);
  }
  for (const [index, name] of FIXED_HEADERS.entries()) {
    if (!columns.has(name)) {
      structureValid = false;
      add(1, name, 'MISSING_HEADER', `Falta el encabezado ${name}.`);
    } else if (columns.get(name) !== index + 1) {
      structureValid = false;
      add(1, name, 'HEADER_POSITION', `La columna ${index + 1} debe ser ${name}.`);
    }
  }
  if (!columns.has('Invitado 1')) {
    structureValid = false;
    add(1, 'Invitado 1', 'MISSING_HEADER', 'Falta el encabezado Invitado 1 después de las tres columnas fijas.');
  }
  const guestColumns = [...columns].filter(([name]) => isGuestHeader(name)).sort(([, a], [, b]) => a - b);
  // Compare actual columns, never allocate or iterate up to an untrusted suffix.
  for (const [index, [name, column]] of guestColumns.entries()) {
    if (name !== `Invitado ${index + 1}` || column !== FIXED_HEADERS.length + index + 1) {
      structureValid = false;
      add(1, name, 'GUEST_HEADER_SEQUENCE', 'Después de las tres columnas fijas, usa Invitado 1, Invitado 2, Invitado 3… consecutivamente, en orden y sin columnas vacías.');
    }
  }
  for (const merge of sheet.mergedCells) {
    structureValid = false;
    add(merge.row, `Columna ${merge.column}`, 'MERGED_CELLS', 'Descombina las celdas de esta hoja.');
  }
  const rows = sheet.rows.filter((row) => row.row > 1 && row.cells.some(hasContent));
  if (rows.length === 0) add(2, 'Invitación', 'EMPTY_IMPORT', 'Agrega al menos una invitación.');
  const recognized = new Set(columns.values());
  const invitations: InvitationPreview[] = [];
  const identical = new Map<string, number>();
  for (const row of rows) {
    const cells = new Map(row.cells.map((cell) => [cell.column, cell]));
    for (const cell of row.cells) if (hasContent(cell) && !recognized.has(cell.column)) {
      add(row.row, `Columna ${cell.column}`, 'UNKNOWN_COLUMN', 'Esta columna contiene datos y no pertenece a la plantilla.');
    }
    const validateCell = <T,>(field: string, normalize: (cell?: ImportCell) => T | null, message: string): T | null => {
      if (!columns.has(field)) return null;
      const cell = cells.get(columns.get(field)!);
      if (cell?.formula) {
        add(row.row, field, 'FORMULA', 'Pega el valor, no una fórmula, aunque Excel muestre un resultado.');
        return null;
      }
      const value = normalize(cell);
      if (value === null) add(row.row, field, 'INVALID_VALUE', message);
      return value;
    };
    const invitation: InvitationPreview = {
      row: row.row,
      displayName: validateCell('Invitación', textValue, 'Falta el nombre de la invitación; debe ser texto.'),
      openSlots: validateCell('Espacios abiertos', openSlotsValue, 'Escribe un entero no negativo representable con precisión; no dejes la celda vacía ni uses fechas.'),
      replacementsAllowed: validateCell('Permitir sustituciones', replacementsValue, 'Escribe Sí, Si o No, o un booleano de Excel; la celda es obligatoria.'),
      knownGuests: [], valid: false, input: null,
    };
    const lastFilled = guestColumns.findLastIndex(([, column]) => {
      const cell = cells.get(column);
      return cell !== undefined && hasContent(cell);
    });
    const seen = new Set<string>();
    for (let index = 0; index <= lastFilled; index++) {
      const [field, column] = guestColumns[index];
      const cell = cells.get(column);
      if (!cell || !hasContent(cell)) {
        add(row.row, field, 'GUEST_GAP', 'Existe un espacio vacío entre invitados. Coloca los nombres consecutivamente desde Invitado 1.');
        continue;
      }
      const name = validateCell(field, textValue, 'El nombre de la persona debe ser texto no vacío.');
      if (name === null) continue;
      if (seen.has(name)) add(row.row, field, 'DUPLICATE_NAME', 'Nombre repetido dentro de esta invitación. No se eliminará automáticamente.', 'warning');
      seen.add(name);
      invitation.knownGuests.push({ name, row: row.row, column });
    }
    const capacity = invitation.openSlots === null ? null : invitation.openSlots + invitation.knownGuests.length;
    if (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < 1)) add(row.row, 'Cupos', 'INVALID_CAPACITY', 'Agrega al menos una persona o un espacio abierto; el total debe poder representarse con precisión.');
    invitation.valid = structureValid && !errorRows.has(row.row) && invitation.displayName !== null
      && invitation.openSlots !== null && invitation.replacementsAllowed !== null;
    if (invitation.valid) {
      invitation.input = {
        displayName: invitation.displayName!, knownGuests: invitation.knownGuests.map(({ name }) => ({ name })),
        openSlots: invitation.openSlots!, replacementsAllowed: invitation.replacementsAllowed!,
      };
      // Warning only: preserve independent rows and original guest order in payloads.
      const signature = JSON.stringify([invitation.displayName, invitation.knownGuests.map(({ name }) => name).sort(), invitation.openSlots, invitation.replacementsAllowed]);
      const previous = identical.get(signature);
      if (previous !== undefined) add(row.row, 'Invitación', 'IDENTICAL_INVITATION', `Contenido idéntico al de la fila ${previous}. Se conservarán ambas invitaciones independientes.`, 'warning');
      else identical.set(signature, row.row);
    }
    invitations.push(invitation);
  }
  return buildImportPreview(invitations, issues);
}
