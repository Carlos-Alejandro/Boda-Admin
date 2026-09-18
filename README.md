# React + TypeScript + Vite

## Importación XLSX de invitaciones (etapas 1 y 2)

Desde el listado, abre **Importar Excel** (`/invitaciones/importar`). La lectura,
validación y vista previa son locales. Tras confirmar un archivo completamente válido,
se crean las invitaciones secuencialmente con claves idempotentes en memoria.
Se detiene ante el primer fallo, sin rollback ni reintentos. No cierres ni recargues
durante la creación; la recuperación persistente queda para la etapa 3.
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
