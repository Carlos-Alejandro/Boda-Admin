import { mkdir } from 'node:fs/promises';
import ExcelJS from 'exceljs';

const book = new ExcelJS.Workbook();
book.creator = 'Boda-Admin';
book.title = 'Plantilla de invitaciones';
const C = {
  cream: 'FFF9F7F1', paper: 'FFFEFDFC', dark: 'FF103C2F', green: 'FF185A3B',
  sage: 'FFEAF1E9', sageDark: 'FFDCE8DC', line: 'FFD8E2D8',
  text: 'FF344D48', muted: 'FF60736F',
};
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const font = (size = 11, bold = false, argb = C.dark, name = 'Aptos') => ({ name, size, bold, color: { argb } });
const line = { bottom: { style: 'thin', color: { argb: C.line } } };

function paint(sheet, r1, r2, c1, c2, argb) {
  for (let row = r1; row <= r2; row++) for (let col = c1; col <= c2; col++) sheet.getCell(row, col).fill = fill(argb);
}
function text(sheet, range, value, options = {}) {
  if (range.includes(':')) sheet.mergeCells(range);
  const cell = sheet.getCell(range.split(':')[0]);
  cell.value = value;
  cell.font = font(options.size ?? 11, options.bold ?? false, options.color ?? C.dark, options.family ?? 'Aptos');
  cell.alignment = {
    vertical: options.vertical ?? 'middle', horizontal: options.align ?? 'left',
    wrapText: true, indent: options.indent ?? 0,
  };
  return cell;
}

const guide = book.addWorksheet('Instrucciones', {
  properties: { tabColor: { argb: C.dark }, defaultRowHeight: 28 },
  views: [{ showGridLines: false, zoomScale: 85 }],
  pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
});
guide.getColumn(1).width = 3;
for (let col = 2; col <= 19; col++) guide.getColumn(col).width = 10.8;
guide.getColumn(20).width = 3;
guide.getRow(1).height = 12;
for (let row = 2; row <= 22; row++) guide.getRow(row).height = 28;
guide.getRow(3).height = 36;
guide.getRow(4).height = 34;
guide.getRow(10).height = 18;
guide.getRow(12).height = 38;
paint(guide, 2, 22, 2, 19, C.paper);
paint(guide, 2, 9, 8, 19, C.sage);
paint(guide, 11, 19, 2, 7, C.cream);
paint(guide, 21, 22, 2, 19, C.sage);

text(guide, 'B3:B4', '❦', { size: 30, color: C.green, align: 'center', family: 'Georgia' });
text(guide, 'C3:G4', 'Plantilla de invitaciones', { size: 18, bold: true, family: 'Georgia' });
text(guide, 'C5:G7', 'Esta plantilla te ayudará a crear tu lista de invitados de manera sencilla y sin errores.', { size: 12, color: C.muted });
text(guide, 'H2:S2', 'Recomendaciones rápidas', { size: 13, bold: true, color: C.green, indent: 1 });
const recommendations = [
  ['H', 'J', '01', 'Una invitación por fila', 'Cada fila de Excel será una invitación.'],
  ['K', 'M', '02', 'Una persona por columna', 'Llena los nombres en columnas separadas (Invitado 1, Invitado 2, etc.).'],
  ['N', 'P', '03', 'Usa solo valores', 'No uses fórmulas en Excel.'],
  ['Q', 'S', '04', 'Puedes agregar más columnas', 'Si necesitas más invitados, agrega columnas consecutivas (Invitado 11, 12, etc.).'],
];
for (const [start, end, number, title, body] of recommendations) {
  const badge = text(guide, `${start}3:${end}4`, Number(number), { size: 18, bold: true, color: C.green, align: 'center' });
  badge.numFmt = '00';
  text(guide, `${start}5:${end}5`, title, { size: 10, bold: true, align: 'center' });
  text(guide, `${start}6:${end}9`, body, { size: 10, color: C.text, align: 'center', vertical: 'top' });
}

text(guide, 'B11:G11', 'Columnas que debes completar', { size: 13, bold: true, indent: 1 });
const fields = [
  ['Invitación', 'Nombre del grupo o familia que vas a invitar.'],
  ['Espacios abiertos', 'Número de lugares adicionales sin nombre. Escribe 0 o un entero positivo.'],
  ['Permitir sustituciones', 'Sí permite reemplazar a una persona invitada cuando corresponda; No lo impide.'],
  ['Invitado 1, Invitado 2, etc.', 'Escribe una persona por columna, consecutivamente y sin dejar huecos.'],
];
for (let i = 0; i < fields.length; i++) {
  const row = 12 + i * 2;
  text(guide, `B${row}:B${row + 1}`, i + 1, { size: 16, bold: true, color: C.green, align: 'center' });
  text(guide, `C${row}:G${row}`, fields[i][0], { size: 10, bold: true });
  text(guide, `C${row + 1}:G${row + 1}`, fields[i][1], { size: 9.5, color: C.text, vertical: 'top' });
}

text(guide, 'H11:S11', 'Ejemplo de cómo llenar la plantilla', { size: 13, bold: true });
const exampleColumns = [
  ['H', 'J', 'Invitación'], ['K', 'L', 'Espacios abiertos'],
  ['M', 'N', 'Permitir sustituciones'], ['O', 'P', 'Invitado 1'],
  ['Q', 'R', 'Invitado 2'], ['S', 'S', 'Invitado 3'],
];
for (const [start, end, title] of exampleColumns) {
  const cell = text(guide, start === end ? `${start}12` : `${start}12:${end}12`, title, { size: 9, bold: true, align: 'center' });
  cell.fill = fill(C.sageDark);
}
const examples = [
  ['Familia Martínez', 2, 'Sí', 'Carlos Martínez', 'María López', 'Sofía López'],
  ['Amigos del trabajo', 4, 'No', 'Luis Torres', 'Ana Torres', ''],
  ['Familia Ramírez', 1, 'Sí', 'Pedro Ramírez', 'Laura Méndez', ''],
];
for (let i = 0; i < examples.length; i++) for (let j = 0; j < exampleColumns.length; j++) {
  const [start, end] = exampleColumns[j];
  const row = 13 + i;
  const cell = text(guide, start === end ? `${start}${row}` : `${start}${row}:${end}${row}`,
    examples[i][j], { size: 9, color: C.text, align: j === 1 || j === 2 ? 'center' : 'left' });
  cell.border = line;
}
text(guide, 'H17:S19', 'El ejemplo es solo informativo. Para importar, completa la hoja Invitaciones.', { size: 11, color: C.muted, indent: 1 });
text(guide, 'B21:B22', 'ⓘ', { size: 18, color: C.green, align: 'center' });
text(guide, 'C21:S22', 'Recuerda: escribe los invitados consecutivamente desde Invitado 1, sin dejar huecos. Puedes agregar más columnas Invitado N si las necesitas.', { size: 10, color: C.text });
guide.printArea = 'B2:S22';

// The import sheet has exactly one populated row. Styled empty cells can appear
// as data to workbook readers, so only headers receive individual cell styles.
const invitations = book.addWorksheet('Invitaciones', {
  properties: { tabColor: { argb: C.green }, defaultRowHeight: 29 },
  views: [{ state: 'frozen', xSplit: 0, ySplit: 1, showGridLines: false, zoomScale: 90 }],
});
// Ten starter guest columns are a convenience, never a business limit.
const headers = ['Invitación', 'Espacios abiertos', 'Permitir sustituciones',
  ...Array.from({ length: 10 }, (_, index) => `Invitado ${index + 1}`)];
headers.forEach((header, index) => {
  invitations.getColumn(index + 1).width = index === 0 ? 36 : index === 1 ? 22 : index === 2 ? 28 : 26;
  const cell = invitations.getCell(1, index + 1);
  cell.value = header;
  cell.font = font(11, true);
  cell.fill = fill(index < 3 ? C.cream : C.sage);
  cell.border = line;
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
});
invitations.getRow(1).height = 40;
for (let row = 2; row <= 101; row++) {
  invitations.getRow(row).height = 29;
  for (let col = 1; col <= headers.length; col++) {
    const cell = invitations.getCell(row, col);
    cell.fill = fill(row % 2 === 0 ? C.paper : C.cream);
    cell.border = line;
    cell.font = font(11, false, C.text);
    cell.alignment = { vertical: 'middle' };
  }
}

await mkdir('public/templates', { recursive: true });
await book.xlsx.writeFile('public/templates/plantilla-invitaciones-v1.xlsx');
