# Importación XLSX — etapas 1 y 2

Ruta protegida: `/invitaciones/importar`, accesible desde el listado.
Etapa 1: lectura, validación y vista previa local, sin solicitudes de creación.
Etapa 2: confirmación explícita y creación secuencial en memoria mediante Boda-API.
Etapa 3 pendiente: persistencia, reanudación, reconciliación y reintentos seguros.
No se persisten archivos, payloads, resultados ni claves fuera de memoria.

## Ejecución (etapa 2)

Solo se habilita Importar cuando el análisis global es válido, no hay errores
estructurales ni de contenido y todas las filas tienen un payload válido. No se
filtra un subconjunto de filas válidas de un archivo inválido. Las advertencias
no bloquean. La confirmación muestra invitaciones y cupos totales; Cancelar no
envía nada. La lectura del XLSX sigue siendo local: solo se envían payloads al confirmar.

Al confirmar se copia cada `CreateInvitationInput`, conservando el orden de personas,
y se genera una clave `boda-import-v1:<crypto.randomUUID()>` por fila. Se comprueba
su formato y unicidad antes de enviar. Las claves viven en los elementos de ejecución,
no en el render, el JSON, la UI ni los logs. No son IDs públicos. Cada elemento
conserva fila original, nombre, payload, clave, estado y, cuando están confirmados,
ID y versión de Boda-API. Se usa `createInvitation(input, { idempotencyKey, signal })`;
la creación manual continúa sin requerir opciones ni header idempotente.

Solo hay una petición en vuelo: se espera cada respuesta antes de enviar la siguiente.
Solo HTTP 200 y 201 confirman creación; una respuesta sin ID u otro estado 2xx
(por ejemplo, 202 Accepted), incluso con ID, se considera desconocida y detiene la secuencia.
400, 401, 403, 409, 412 y 429 son fallos definitivos para esta ejecución. El conflicto
`IDEMPOTENCY_CONFLICT` tiene mensaje específico. Los mensajes visibles son españoles
y locales: el mensaje de validación existente solo verifica forma/longitud, por lo que
el importador no reproduce texto arbitrario del backend. La normalización compartida
de validación sigue disponible para sus consumidores anteriores.

5xx, red, HTTP 408 y timeout son `unknown`: no puede determinarse con seguridad si
el backend creó la invitación. Cada petición tiene un presupuesto técnico de 30 segundos,
incluida la espera del token. Se aborta al agotarlo, se ignoran respuestas tardías y no
se inicia la siguiente fila. Abortar no deshace una creación recibida por el servidor.

Se detiene en el **primer fallo**, definitivo o desconocido. Las filas siguientes
quedan `pending`/no procesadas. Una ejecución puede quedar parcialmente creada;
no existe rollback: no se archivan, borran ni modifican las invitaciones anteriores.
No hay retry automático ni botón de reintento. **No se debe repetir manualmente
una operación unknown con una clave nueva**, porque podría duplicar la invitación.

Un guard síncrono además de los botones deshabilitados impide doble confirmación,
ejecuciones simultáneas y cambiar el archivo durante confirmación/creación. La misma
vista previa no puede ejecutarse otra vez tras terminar. Seleccionar un archivo después
de terminar limpia los resultados y abre otra sesión efímera; sus claves se generan
solo al confirmar. Volver a seleccionar un Excel ya importado **no deduplica** sus filas:
las claves son de ejecución, no hashes del contenido. La UI lo advierte.

No se bloquea navegación global ni se usa beforeunload. Salir desmonta la página,
aborta la petición local y evita programar más filas; la petición enviada puede haberse
completado en el servidor. Recargar/cerrar pierde claves y resultados, sin recuperación
en esta etapa. Conservarlos y reconciliar con la misma clave corresponde a la etapa 3.
Requiere navegador con `crypto.randomUUID()` y contexto seguro; si falla la preparación,
no se envía ninguna invitación. No hay límites globales de negocio.

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
Boda-API genera el ID real al confirmar la creación.
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
Con archivo válido, Importar abre una confirmación. Las pruebas automatizadas usan
API simulada: verifican secuencia sin concurrencia, doble submit, claves y header,
200/201, cada fallo, timeout, resultados parciales, cambio de archivo, desmontaje,
no creación antes de confirmar y compatibilidad de la creación manual. No crean datos reales.
Al recargar se pierde el análisis y la ejecución: no existe almacenamiento persistente.
