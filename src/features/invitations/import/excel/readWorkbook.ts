import { read, utils } from 'xlsx';
import type { ImportCell, ImportWorkbook } from '../model/import.types';
import { MAX_EXPANDED_BYTES, MAX_FILE_BYTES } from './technicalLimits';

// Check central-directory sizes before SheetJS decompresses the archive.
function inspectZip(bytes: Uint8Array): string[] {
  if (bytes.length > MAX_FILE_BYTES) throw new Error('El archivo supera la protección técnica de 25 MiB. Divide el archivo; no hay un límite global de invitaciones.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 22 || view.getUint32(0, true) !== 0x04034b50) throw new Error('El archivo no es un XLSX válido. Guárdalo como Libro de Excel (.xlsx).');
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && view.getUint32(end, true) !== 0x06054b50) end--;
  if (end < Math.max(0, bytes.length - 65557)) throw new Error('El archivo XLSX está incompleto o dañado.');
  if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw new Error('No se admiten archivos divididos en varios volúmenes.');
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  if (count === 65535 || offset === 0xffffffff) throw new Error('El contenedor ZIP64 no está admitido. Guarda un XLSX estándar.');
  let expanded = 0;
  const names: string[] = [];
  for (let index = 0; index < count; index++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error('El archivo XLSX está dañado.');
    if (view.getUint16(offset + 8, true) & 1) throw new Error('No se admiten archivos cifrados. Guarda una copia sin contraseña.');
    expanded += view.getUint32(offset + 24, true);
    if (expanded > MAX_EXPANDED_BYTES) throw new Error('El contenido descomprimido supera la protección técnica de 128 MiB. Divide el archivo.');
    const length = view.getUint16(offset + 28, true);
    const next = offset + 46 + length + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
    if (next > end) throw new Error('El archivo XLSX está dañado.');
    names.push(new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + length)));
    offset = next;
  }
  return names;
}

export function readWorkbook(data: ArrayBuffer): ImportWorkbook {
  const bytes = new Uint8Array(data);
  const entries = inspectZip(bytes);
  if (!entries.includes('[Content_Types].xml') || !entries.includes('xl/workbook.xml')) throw new Error('El archivo no contiene un libro XLSX estándar.');
  if (entries.some((name) => /vbaproject\.bin$/i.test(name))) throw new Error('No se admiten libros con macros. Guarda una copia XLSX sin macros.');
  try {
    // Preserve formula cells without cached results; otherwise SheetJS can omit them.
    const workbook = read(data, { type: 'array', cellFormula: true, sheetStubs: true, cellDates: true, cellHTML: false, cellText: false, bookFiles: true });
    const files = (workbook as typeof workbook & { files?: Record<string, { content?: Uint8Array | string }> }).files;
    const content = files?.['[Content_Types].xml']?.content;
    const contentTypes = typeof content === 'string' ? content : content ? new TextDecoder().decode(content) : '';
    if (!contentTypes.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml')) throw new Error('unsupported');
    return {
      sheets: workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name];
        const rows = new Map<number, ImportCell[]>();
        for (const address of Object.keys(sheet)) {
          if (!/^[A-Z]+[1-9]\d*$/.test(address)) continue;
          const position = utils.decode_cell(address);
          const cell = sheet[address];
          const row = rows.get(position.r + 1) ?? [];
          row.push({ column: position.c + 1, value: cell.t === 'z' ? null : cell.v, type: cell.t, formula: cell.f !== undefined || cell.F !== undefined });
          rows.set(position.r + 1, row);
        }
        return {
          name,
          rows: [...rows].sort(([a], [b]) => a - b).map(([row, cells]) => ({ row, cells })),
          mergedCells: (sheet['!merges'] ?? []).map((range) => ({ row: range.s.r + 1, column: range.s.c + 1 })),
        };
      }),
    };
  } catch {
    throw new Error('No se pudo leer el libro XLSX. Puede estar dañado o tener un formato no admitido; guarda una nueva copia como .xlsx.');
  }
}
