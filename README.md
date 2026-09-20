# React + TypeScript + Vite

## Importación XLSX de invitaciones (etapas 1, 2 y 3)

Desde el listado, abre **Importar Excel** (`/invitaciones/importar`). La lectura,
validación y vista previa son locales. Tras confirmar un archivo completamente válido,
se guarda una sesión en IndexedDB antes de crear secuencialmente con claves idempotentes.
Se detiene ante el primer fallo, sin rollback ni reintentos automáticos. Al regresar,
**Continuar importación** recupera y reconcilia con las mismas claves. Los resultados
completados se conservan hasta finalizar. Descartar elimina solo los datos locales;
volver a importar después puede duplicar invitaciones. Requiere Web Locks y navegador
moderno en HTTPS; no borres sus datos mientras necesites recuperar una sesión.
Consulta [el contrato y las pruebas](docs/invitation-import.md).

Completa solo **Invitaciones**, una invitación por fila: `Invitación`, `Espacios abiertos`,
`Permitir sustituciones`, `Invitado 1`, `Invitado 2`, etc. No escribas códigos ni IDs
ni dejes huecos entre personas. La plantilla prepara diez columnas de personas;
puedes agregar más consecutivamente. Los IDs reales los generará Boda-API al crear
invitaciones. `Instrucciones` contiene ejemplos que no se importan.

- `npm test`: pruebas del importador.
- `npm run template:invitations`: regenera la plantilla vacía descargable.
- `npm run lint` y `npm run build`: verificaciones del proyecto.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
