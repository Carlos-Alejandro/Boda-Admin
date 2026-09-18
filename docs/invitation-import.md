# Importación XLSX — etapa 1

Ruta protegida: `/invitaciones/importar`, accesible desde el listado.
Solo lee, valida y muestra una vista previa. No realiza solicitudes de creación,
no genera claves idempotentes y no persiste archivos ni datos personales.

## Dependencia

Se compararon `read-excel-file` y SheetJS CE. La primera ofrece lectura de varias
hojas, tipos y TypeScript, pero documenta que retorna el valor precalculado de las
fórmulas y trata algunas fórmulas sin resultado como celdas vacías. Esa API no permite
rechazar de forma fiable las fórmulas originales. SheetJS expone
`cell.f` y `cell.F`, además de tipos y coordenadas. Se eligió para conservar esa
validación, sin agregar otro parser XML.

Instalación exacta: `npm install --save-exact https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz --allow-remote=root`.
El último argumento autoriza esa dependencia remota directa en la versión local
de npm; no cambia la configuración global. `package-lock.json` registra resolución
e integridad. No se carga un CDN en runtime. La documentación oficial consultada
identifica 0.20.3 como distribución actual y advierte que el paquete npm público
0.18.5 está desactualizado:
https://docs.sheetjs.com/docs/getting-started/installation/nodejs/
https://docs.sheetjs.com/docs/csf/cell/
https://github.com/catamphetamine/read-excel-file#formulas

El parser está en un Worker empaquetado por Vite; la página usa carga diferida.
El peso de SheetJS se descarga al seleccionar un archivo, no al abrir el dashboard.
Revisar los avisos oficiales al actualizar: un `npm audit` limpio no garantiza
ausencia de vulnerabilidades, especialmente para distribuciones fuera del registro.

## Contrato

Una sola hoja de datos obligatoria: `Invitaciones`.
`Instrucciones` es opcional y su contenido no se importa.
Cada fila de datos representa una invitación completa e independiente.

Columnas, en este orden:

1. Invitación
2. Espacios abiertos
3. Permitir sustituciones
4. Invitado 1
5. Invitado 2
6. … Invitado N

Los encabezados se recortan con trim y deben coincidir exactamente. Las tres columnas
fijas van primero; después se exige al menos Invitado 1. Las columnas Invitado N
deben ser consecutivas desde 1, sin saltos, duplicados ni columnas vacías intermedias.
Se detectan todas las columnas presentes, sin un máximo de negocio.

No se solicitan códigos ni identificadores manuales. No se generan IDs en el frontend.
Boda-API seguirá generando el ID real cuando se implemente la creación.
La fila Excel se conserva solo como coordenada para mostrar errores y distinguir
elementos de la vista previa; no es un ID de invitación ni forma parte del payload.

Se rechazan otras hojas como error, incluso si están vacías: no se ignoran datos
de un formato inesperado. Esto incluye la antigua hoja `Invitados`.
No se soportan los formatos anteriores ni se mantienen relaciones entre hojas.
Se rechazan encabezados repetidos/faltantes y columnas desconocidas con contenido.
Las filas vacías se omiten sin renumerar las restantes; también se incluyen filas
ocultas o filtradas. No se admiten celdas combinadas en la hoja de datos, fórmulas,
macros ni libros cifrados.

Nombre de invitación y nombres de personas deben ser texto no vacío tras trim.
No se cambian acentos, ñ, puntuación ni espacios interiores. No se dividen nombres.
Las celdas de personas vacías al final se ignoran. Un vacío antes de una celda
con contenido es un error localizado en Invitado N. Una fórmula cuenta como
contenido y se rechaza, incluso sin resultado almacenado.

Espacios abiertos: entero seguro >= 0 o texto de dígitos; nunca vacío, fecha o booleano.
Sustituciones: Sí/Si/No, sin distinguir mayúsculas, o booleano real.
Capacidad: personas identificadas + espacios abiertos, al menos 1 y representable
exactamente como número de JavaScript para el contrato API. Se admite cero personas
identificadas cuando existen espacios abiertos.

Un error en un campo de la fila invalida esa invitación. Dos filas con el mismo
displayName siguen siendo dos invitaciones independientes y no se bloquean por ello.
Nombres de personas repetidos dentro de una fila generan advertencia.
Contenido lógico idéntico (nombre, personas con multiplicidad, espacios y sustituciones)
genera advertencia, sin fusionar ni bloquear. La comparación para esa advertencia
no depende del orden de las personas; el payload sí conserva el orden Invitado 1…N.

Ejemplo:

| Invitación | Espacios abiertos | Permitir sustituciones | Invitado 1 | Invitado 2 | Invitado 3 |
|---|---|---|---|---|---|
| Familia Martínez | 1 | Sí | Carlos Manuel | América Hernández | María Martínez |
| Julia & Jordi | 0 | No | Julia Pérez | Jordi López | |
| Cassandra & Carlos | 1 | Sí | Cassandra Hernández | Carlos Martínez | |

Los problemas estructurales de Invitaciones invalidan todas las interpretaciones.
Una hoja extra bloquea el archivo aunque existan filas individualmente válidas.
`analysis.valid` es la condición global; no basta con contar filas válidas.

El resumen cuenta todas las invitaciones encontradas. Personas, espacios y cupos
se suman solo para filas válidas y se rotulan así cuando hay errores.
Los agregados usan BigInt serializado a texto para evitar un límite numérico global.
Los payloads válidos reutilizan `CreateInvitationInput`: displayName, knownGuests,
openSlots y replacementsAllowed. No contienen códigos, IDs ni coordenadas Excel.
Los errores conservan severity, sheet, row, column, code y message; el campo code
es el tipo de error, no un identificador que deba proporcionar el usuario.

## Protecciones técnicas

En `excel/technicalLimits.ts`: 25 MiB de archivo, 128 MiB de tamaño descomprimido
declarado en el directorio ZIP y 30 segundos por lectura. Son presupuestos de recursos,
no topes de invitados ni cupos. ZIP64 y archivos multivolumen no están admitidos.
No se truncan filas. El adaptador recorre celdas presentes, no un rectángulo `!ref`
potencialmente enorme. El Worker se termina al cambiar archivo, salir o agotar tiempo.
Estas defensas no equivalen a un sandbox de memoria: un ZIP malicioso que mienta en
sus metadatos sigue siendo un riesgo residual del descompresor.

## Plantilla y pruebas

La plantilla se genera mediante `npm run template:invitations` y contiene únicamente
Instrucciones e Invitaciones. La hoja de datos solo tiene encabezados:
las tres columnas fijas y diez columnas iniciales de personas. Se pueden agregar
Invitado 11, 12, etc. sin cambiar el programa. Diez no representa un máximo.
No hay un máximo global de personas, invitaciones o cupos; siguen existiendo los
límites físicos del formato XLSX y los recursos del navegador.
Los ejemplos informativos viven exclusivamente en Instrucciones.
Se autorizó explícitamente usar SheetJS para generar esta plantilla.

Ejecutar `npm test`, `npm run lint`, `npm run build` y `git diff --check`.
Manual: iniciar sesión, abrir el listado, Importar Excel, descargar la plantilla,
completar Invitaciones y seleccionarla. Los ejemplos dan 3 invitaciones, 7 personas,
2 espacios y 9 cupos. Probar huecos, fórmulas y nombres de invitación repetidos.
Corregir y seleccionar otro archivo debe reemplazar completamente el análisis.
La acción Importar permanece deshabilitada incluso con un archivo válido.
Al recargar se pierde el análisis deliberadamente: no existe almacenamiento persistente.
