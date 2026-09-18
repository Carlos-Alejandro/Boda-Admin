import { mkdirSync, writeFileSync } from 'node:fs';
import { utils, write } from 'xlsx';

const workbook = utils.book_new();
const instructions = [
  ['Boda-Admin · Plantilla de invitaciones v1'],
  ['Completa únicamente Invitaciones. Los ejemplos de esta hoja son informativos y NO se importan.'],
  ['Una fila por invitación', 'Cada fila reúne el nombre de la invitación, los espacios, las sustituciones y las personas.'],
  ['Personas', 'Escribe una persona por columna Invitado N. No dividas nombres ni apellidos.'],
  ['Sin códigos ni IDs', 'No escribas identificadores. Boda-API genera automáticamente el ID real al crear la invitación.'],
  ['Sin huecos', 'Comienza en Invitado 1 y no dejes vacíos entre personas. Las celdas vacías al final se ignoran.'],
  ['Más columnas', 'Puedes agregar Invitado 11, Invitado 12, etc., siguiendo la numeración consecutiva.'],
  ['Sin máximo global', 'Las diez columnas preparadas son solo una ayuda; no hay un máximo global de invitados.'],
  ['Espacios abiertos', 'Lugares adicionales sin nombre: escribe 0 o un entero positivo. No dejes vacío.'],
  ['Permitir sustituciones', 'Escribe Sí, Si o No. También se admiten booleanos reales de Excel.'],
  ['Valores', 'No uses fórmulas. Copia y pega como valores antes de guardar.'],
  ['Orden', 'Invitación, Espacios abiertos, Permitir sustituciones; después Invitado 1, Invitado 2, etc.'],
  ['Capacidad', 'Cada invitación debe tener al menos una persona conocida o un espacio abierto.'],
  ['Nombres de invitación', 'Dos filas con el mismo nombre siguen siendo dos invitaciones independientes.'],
  ['Estructura', 'Conserva los encabezados. No combines celdas ni agregues otras hojas de datos.'],
  [],
  ['Ejemplo de Invitaciones (solo informativo)'],
  ['Invitación', 'Espacios abiertos', 'Permitir sustituciones', 'Invitado 1', 'Invitado 2', 'Invitado 3'],
  ['Familia Martínez', 1, 'Sí', 'Carlos Manuel', 'América Hernández', 'María Martínez'],
  ['Julia & Jordi', 0, 'No', 'Julia Pérez', 'Jordi López'],
  ['Cassandra & Carlos', 1, 'Sí', 'Cassandra Hernández', 'Carlos Martínez'],
];
const guide = utils.aoa_to_sheet(instructions);
guide['!cols'] = [{ wch: 34 }, { wch: 100 }, { wch: 26 }, { wch: 30 }, { wch: 30 }, { wch: 30 }];
utils.book_append_sheet(workbook, guide, 'Instrucciones');
// Ten starter columns are a template convenience, never a validation limit.
const starterGuestHeaders = Array.from({ length: 10 }, (_, index) => `Invitado ${index + 1}`);
const invitations = utils.aoa_to_sheet([['Invitación', 'Espacios abiertos', 'Permitir sustituciones', ...starterGuestHeaders]]);
invitations['!cols'] = [{ wch: 36 }, { wch: 22 }, { wch: 26 }, ...starterGuestHeaders.map(() => ({ wch: 30 }))];
utils.book_append_sheet(workbook, invitations, 'Invitaciones');
mkdirSync('public/templates', { recursive: true });
writeFileSync('public/templates/plantilla-invitaciones-v1.xlsx', write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true }));
