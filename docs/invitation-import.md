# Importación XLSX — etapas 1, 2, 3 y 4

Ruta protegida: `/invitaciones/importar`, accesible desde el listado.
Etapa 1: lectura, validación y vista previa local, sin solicitudes de creación.
Etapa 2: confirmación explícita y creación secuencial mediante Boda-API.
Etapa 3: sesión local persistente, recuperación, reconciliación y continuación explícita.
La creación manual, el contrato de Excel y las validaciones siguen sin cambios.

## Ejecución (etapa 2)

Solo se habilita Importar cuando el análisis global es válido, no hay errores
estructurales ni de contenido y todas las filas tienen un payload válido. No se
filtra un subconjunto de filas válidas de un archivo inválido. Las advertencias
no bloquean. La confirmación muestra invitaciones y cupos totales; Cancelar no
envía nada. La lectura del XLSX sigue siendo local: solo se envían payloads al confirmar.

Al confirmar se copia cada `CreateInvitationInput`, conservando el orden de personas,
y se genera una clave `boda-import-v1:<crypto.randomUUID()>` por fila. Se comprueba
su formato y unicidad antes de enviar. Las claves viven en los elementos de la sesión,
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
No hay retry automático. La acción Continuar usa las claves guardadas. **No se debe repetir manualmente
una operación unknown con una clave nueva**, porque podría duplicar la invitación.

Un guard síncrono además de los botones deshabilitados impide doble confirmación,
ejecuciones simultáneas y cambiar el archivo durante confirmación/creación. La misma
vista previa no puede ejecutarse otra vez tras terminar. Mientras existe una sesión,
el selector de archivos permanece bloqueado. Primero hay que continuar, finalizar
o descartar explícitamente la sesión. Después se exige seleccionar un archivo nuevo;
el preview anterior no puede confirmarse otra vez accidentalmente.

No se bloquea navegación global ni se usa beforeunload. Salir desmonta la página,
aborta la petición local y evita programar más filas; la petición enviada puede haberse
completado en el servidor. La recuperación no se ejecuta automáticamente.
Requiere navegador moderno y contexto seguro; si falla la preparación,
el almacenamiento o el bloqueo, no se envía ninguna invitación nueva.
No hay límites globales de negocio.

## Sesión persistente (etapa 3)

Se eligió **IndexedDB nativo**, no localStorage: permite transacciones atómicas,
estructuras clonadas y acceso asíncrono sin serializar todo el batch en un almacén
síncrono de cadenas. No agrega librerías al bundle de producción. `fake-indexeddb`
es únicamente una dependencia de desarrollo para probar el adaptador real.

Base `boda-import-session`, versión de base 1, object store `sessions`, clave `active`.
Se conserva una sesión local activa por origen del navegador; no es un límite de
invitaciones/personas/cupos. No se sobrescribe una sesión incompleta ni completada.
No se usan cookies, localStorage, sessionStorage, Firestore ni endpoints nuevos.

Estructura del registro:

```text
formatVersion: 1
id: UUID local del batch (no es un ID de invitación)
filename: nombre original del archivo
createdAt, updatedAt: fechas ISO
apiBaseUrl: destino de Boda-API, para impedir replay hacia otro entorno
fingerprint: SHA-256 hexadecimal
status: incomplete | completed
items[]:
  row, displayName, payload: CreateInvitationInput
  idempotencyKey
  status: pending | creating | created | failed | unknown
  invitationId?, version?, error? (mensaje local seguro), errorStatus? (HTTP)
```

Solo se guardan datos necesarios para la recuperación. No se guardan el binario XLSX,
tokens, headers, datos del administrador, respuestas HTTP completas ni stack traces.
Los nombres y claves quedan en el perfil local del navegador, sin cifrado propio.
Otros usuarios del mismo perfil/dispositivo pueden acceder a ellos; cerrar sesión
no borra la importación. Se debe continuar con la cuenta y el entorno originales.
Cada POST obtiene su Firebase ID token mediante el apiClient existente; sin sesión
autenticada, Continuar no altera el registro ni envía operaciones. No se vincula la
sesión a un UID persistido, conforme al requisito de no guardar datos del administrador.

No hay caducidad automática. La sesión dura hasta Finalizar/Descartar, salvo eliminación
externa de datos del navegador. Completed también se conserva después de un refresh.
Finalizar elimina solo los resultados locales y no llama API. Descartar requiere una
confirmación visible y elimina solo la sesión local, nunca invitaciones. **Después de
eliminar las claves, volver a importar el mismo Excel puede crear duplicados**. El
fingerprint no conserva un historial ni garantiza deduplicación tras el descarte.

### Fingerprint

Web Crypto SHA-256 sobre UTF-8 de esta serialización JSON, sin espacios añadidos:

```js
JSON.stringify(['boda-import-logical:v1', inputs.map(input => [
  input.displayName,
  input.knownGuests.map(guest => guest.name),
  input.openSlots,
  input.replacementsAllowed,
])])
```

Se usan los valores ya normalizados de Etapa 1, sin volver a cambiar nombres ni
orden. Cuenta el orden de las invitaciones y personas, incluidos duplicados. No
cuentan filas vacías, coordenadas físicas, filename, fecha o tamaño del archivo,
claves, IDs ni estado de ejecución. Sirve para identificar el conjunto lógico y
comprobar que el payload guardado no cambió; no reemplaza las claves idempotentes.
Se valida el esquema versionado, payloads, orden de filas, unicidad de claves y
consistencia de completed antes de restaurar. Una sesión dañada/incompatible bloquea
la creación: no se repara ni se borra automáticamente. No es defensa contra XSS o
manipulación maliciosa completa del almacenamiento local.

### Orden de guardado y errores

1. Adquirir bloqueo, releer almacenamiento y comprobar autenticación.
2. Generar una sola vez todas las claves y el batch. Guardar el batch completo.
3. Marcar la fila `creating` y guardar esa transición.
4. Solo tras el evento `complete` de la transacción, enviar el POST.
5. Conservar la respuesta normalizada en memoria y guardar resultado, ID/versión y
   estado de sesión; solo después avanzar a la siguiente fila.

Las escrituras piden `durability: strict`; se comprueba que el navegador lo admite.
No basta con el éxito de `put`: se espera el commit de la transacción. Abrir/operar
el almacenamiento tiene una protección técnica de 10 segundos. Un error de cuota,
permisos, transacción abortada o base bloqueada detiene el flujo y muestra un mensaje
seguro. No se envía el POST correspondiente si falló guardar su estado previo.
Véase [durabilidad de transacciones IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/transaction).

Si falló guardar un resultado, se conserva lo conocido en memoria y no se envía la
siguiente fila. No se afirma que sea seguro recargar. Continuar vuelve a tomar el
bloqueo y relee el registro: puede guardar los IDs confirmados en esta pestaña que
no llegaron al disco, sin reenviar esas filas. Si el fallo fue al guardar el último
resultado, se ofrece Guardar resultados antes de Finalizar. Si se perdió
la memoria, el último estado durable `creating` permite reconciliar con la misma clave.
Si falló el primer guardado y no existe registro, no hubo POST: la sesión en memoria
se puede descartar explícitamente; no se recrean sesiones ausentes silenciosamente.

### Recuperación y reconciliación

Entrar en la página lee el registro y muestra fecha, archivo, resumen y resultados,
sin iniciar peticiones. `creating` recuperado se interpreta como `unknown`, nunca
como pending. Comprobar sesión local permite consultar cambios de otras pestañas.
Continuar toma el bloqueo y **relee** la sesión, sin confiar en una vista antigua.

Primero procesa unknown en su orden original; usa exactamente la misma clave y
payload contra POST /api/admin/invitations. HTTP 200 o 201 con ID confirmado resuelve
la fila; se guarda antes de continuar. Nunca busca por displayName ni consulta
Firestore. Después procesa pending en orden. Created se omite siempre.

Un nuevo fallo detiene todo. 408/5xx/red/timeout/2xx inesperado conserva unknown.
400/409/412 y otros rechazos no recuperables bloquean la sesión sin cambiar el payload.
No se saltan filas fallidas. 401/403/429 permiten otro intento **explícito** mediante
Continuar después de resolver sesión/permisos/espera, con idénticos payload y clave.
No hay backoff ni reintento automático. Si existe un fallo bloqueante, no se envía
ninguna otra operación de esa sesión.

La marca opcional `mayHaveBeenCreated` conserva la incertidumbre de intentos previos,
incluso si reconciliar termina en un rechazo HTTP. Solo una respuesta confirmada la
elimina. Descartar distingue cero creaciones, IDs confirmados (con cantidades) y
operaciones inciertas; explica la pérdida de claves y el riesgo de duplicados.
La confirmación captura el estado revisado y lo compara bajo el bloqueo con el
registro actual. Si otra pestaña avanzó, exige revisar y confirmar de nuevo antes
de eliminar únicamente la sesión local. Un rechazo por bloqueo permite actualizar
la vista con Comprobar sesión; un commit fallido conserva la evidencia en memoria.

### Varias pestañas y limitaciones

Web Locks API, nombre `boda-import-session:v1`, modo exclusivo, `ifAvailable: true`.
El bloqueo cubre la ejecución completa, la creación inicial y el descarte/finalización.
La segunda pestaña recibe un aviso; no queda en una cola que inicie POSTs después
sin otra acción del usuario. Toda mutación vuelve a consultar el registro dentro
del bloqueo y comprueba el ID de sesión. El store también impide sobreescrituras y
recrear mediante update una sesión eliminada.
Véase [Web Locks request](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request).

Fallback seguro: sin Web Locks, Web Crypto, IndexedDB o durabilidad strict, no se
permite ejecutar; no se usa un lease casero ni se continúa sin persistencia. Se
requiere HTTPS (localhost para desarrollo) y navegador compatible. Desmontar aborta
la petición local y evita nuevas filas; si el contexto sigue vivo intenta guardar
su último resultado antes de liberar el bloqueo. Cerrar el proceso puede dejar
creating en disco. Un POST recibido por el servidor puede continuar después del cierre:
la idempotencia del backend, no el lock local, resuelve ese caso.

La protección es por origen y perfil del navegador; no coordina dispositivos ni
perfiles diferentes. El navegador/usuario puede borrar o evacuar datos, especialmente
en modo privado: no hay garantía tras perder el almacenamiento local. La recuperación
también depende de conservar los receipts idempotentes en Boda-API. No se implementan
historial entre dispositivos, edición de payloads fallidos, exportación de sesiones
ni rediseño visual (fuera de esta etapa).

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
El análisis sin confirmar sigue siendo efímero; después de confirmar se recupera la
sesión normalizada. Las pruebas incluyen el escenario AAA111 / creating / pending,
reconciliación 200 BBB222 y creación 201 CCC333 con las tres claves originales,
fallos de almacenamiento antes/después del POST, bloqueo entre pestañas, descarte,
completed tras refresh y reparación de resultados confirmados solo en memoria.

## Ajustes de interfaz (etapa 4)

La vista previa consumida y sus mensajes se ocultan después de Finalizar o Descartar.
Se exige seleccionar otro archivo para mostrar una nueva vista previa. Las sesiones
restauradas se identifican como recuperadas del almacenamiento local; leerlas no
inicia envíos. El éxito completo ofrece revisar detalles, volver al listado o
finalizar. Si falta guardar resultados, Guardar resultados conserva los IDs
confirmados sin otro POST. Los fallos bloqueantes no recomiendan continuar.
Finalizar explica que elimina solo los resultados y claves locales y advierte
del riesgo de repetir el Excel.

El progreso muestra X / total procesadas, estados por fila en texto y un elemento
progress con nombre y descripción accesibles. Procesadas incluye creadas, fallidas
y desconocidas; no equivale a creadas correctamente. Durante una reconciliación,
la fila activa vuelve a estar en proceso. El resumen usa status, aria-live polite
y aria-atomic. No se modifican el almacenamiento ni el motor de ejecución.

Manual: finalizar y descartar comprobando que no reaparece el preview; seleccionar
otro Excel. Volver a la ruta con una sesión pendiente o completada y comprobar
el aviso de recuperación sin envíos automáticos. Revisar con lector de pantalla
el progreso, la reconciliación y la detención. Verificar que Finalizar y Descartar
conservan las invitaciones del listado y que los enlaces abren su detalle.
