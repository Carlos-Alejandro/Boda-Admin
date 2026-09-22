# Dashboard: estado actual de la boda

El resumen consulta `GET /api/admin/invitations` sin filtros. El contrato actual
devuelve la colección completa; si `total` difiere de `items.length`, la pantalla
muestra error en vez de publicar métricas parciales. No hay suscripción en tiempo
real: se indica la hora de consulta en America/Cancun y se consulta de nuevo al
volver a montar la página. Durante la carga no se muestran ceros provisionales.

## Unidades y métricas

- Invitaciones activas: `isArchived === false`. Archivadas se cuentan aparte.
- Cupos actuales: suma de `maxGuests` exclusivamente de invitaciones activas.
- Persona identificada: registro cuyo `name.trim()` no está vacío, sea `known`,
  `open` o `replacement`. No implica identidad única entre invitaciones.
- Asisten / no asisten: personas identificadas con `attending === true / false`.
- Sin respuesta: personas identificadas con `attending === null`.
- Espacios sin asignar: `type === 'open'` sin nombre. No son personas ni respuestas,
  incluso cuando su asistencia almacenada sea false (o un true inconsistente).
- Respuesta RSVP: `(asisten + no asisten) / personas identificadas * 100`.
  Se muestra con hasta un decimal, numerador y denominador. Sin personas se omite
  el porcentaje y la barra; se muestra «Sin personas identificadas».
- Replacement: cuenta la persona actualmente representada, una sola vez. El nombre
  original no se añade como otra persona ni como otra respuesta negativa.
- Seguimiento: personas identificadas sin respuesta y número de invitaciones
  activas que contienen al menos una. Un `partial` no genera una tarea por sí solo.

## Selecciones y gráficos

Los límites de cinco elementos solo afectan la presentación, nunca las métricas.

- Anillo SVG: distribución de `rsvpStatus` de invitaciones activas. Centro con total
  de invitaciones; leyenda HTML con los cuatro estados y cantidades. El SVG es
  decorativo para lectores de pantalla porque toda su información está en texto.
- Barras horizontales HTML/CSS: cinco invitaciones activas de mayor capacidad;
  empates por nombre en es-MX y finalmente ID. Las etiquetas indican cupos reales.
  La orientación permite leer nombres largos y conservar el gráfico en móvil.
- Personas sin respuesta: primeras cinco por nombre de invitación, luego ID y
  posición de la persona en su invitación. Nunca se deduplican por nombre.
- Actualizaciones: primeras cinco activas con `updatedAt` válido, descendente;
  empates por nombre e ID. Sin fecha válida no se inventa una. Solo se muestran
  última actualización y estado actual; incluye cambios administrativos y RSVP.

Todos los enlaces llevan al listado general o a detalles existentes. El listado
no soporta filtros por URL, por eso no se agregan parámetros ficticios. Las acciones
reutilizan creación, importación y listado existentes. No se agregan rutas, tracking,
historial, notificaciones, ajustes, búsqueda global ni dependencias de gráficos.

## Validación manual

1. Revisar desktop amplio, tablet y móvil (320–390 px): cuatro/dos/una tarjetas;
   paneles adaptados, sin desplazamiento horizontal. Probar nombres muy largos.
2. Con registros de prueba, comparar personas y cupos con el detalle. Un open
   anónimo false o null no debe sumar negativos ni pendientes. Verificar replacement.
3. Archivar una invitación y volver al Dashboard: excluirla de todas las métricas
   activas, las barras y las listas; conservarla en el conteo de archivadas.
4. Probar cero invitaciones, solo archivadas y solo espacios sin asignar.
5. Probar error de red y Reintentar; durante la carga no deben aparecer métricas.
6. Navegar con teclado por tarjetas de acciones, listas y enlaces. Con lector de
   pantalla revisar títulos, leyenda textual y progreso RSVP.
7. Cambiar administrativamente una invitación: debe aparecer como actualizada,
   sin atribuir una confirmación, apertura o creación.

Las pruebas automatizadas usan API simulada y cubren cálculos, selecciones, estado
vacío/carga/error/reintento, listado parcial, enlaces, unidades y ausencia de
funcionalidades ficticias. No escriben datos de bodas reales.
