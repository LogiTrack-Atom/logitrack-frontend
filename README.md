# logitrack-frontend

Cliente web de LogiTrack Atom: gestión de envíos, repartidores y acceso por roles mediante API Gateway.

> **Estado: base del frontend (S04-02).** Todo funciona con **datos provisionales (mock)**. No hay
> integración real con el backend ni sesión de usuario. Ver [Estado y límites](#estado-y-límites).

## Requisitos

- Node `^20.19.0 || >=22.12.0` (declarado en `engines` de `package.json`).
- npm. Probado con npm 10.8.2.

## Instalación y scripts

```bash
npm ci          # instala exactamente lo que dice package-lock.json
npm run dev     # servidor de desarrollo
npm run build   # tsc -b && vite build
npm run lint    # ESLint
npm test        # Vitest (pruebas de humo, entorno jsdom)
npm run preview # sirve el build local
```

Usar `npm ci` en un clon limpio. Las versiones de las herramientas están en `package.json`.
Vitest, jsdom y Testing Library están fijados en versiones exactas: las últimas versiones de
Vitest y jsdom exigen Node 22 o superior, y esta base se probó con Node 20.19.

> Nota: con npm 10.8.2, agregar Vitest con `npm install` falló por un error interno de npm al
> resolver sus dependencias peer, y se instaló con `--legacy-peer-deps`. `npm ci` sobre el
> lockfile actual funciona sin ningún flag.

## Variables de entorno

Plantilla en `.env.example`. Las variables `VITE_*` son públicas: no poner secretos.

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `VITE_API_BASE_URL` | vacío (mismo origen) | Base de las llamadas al backend. |
| `VITE_USE_MOCKS` | `true` | Los mocks quedan activos salvo que valga exactamente `false`. |

## Estructura

```
src/
  app/        App, router, registro de módulos (modules.tsx) y página 404
  layouts/    AppLayout: cabecera, menú generado del registro, banner de mocks
  modules/    un módulo autónomo por carpeta (home, auth, couriers, shipments)
    <modulo>/types.ts      modelos
    <modulo>/mocks/        datos provisionales
    <modulo>/services/     funciones que llaman al backend vía withMock
  shared/
    components/  Button, PageHeader, MockBanner, PagePlaceholder
    config/      env.ts (variables) y api.ts (prefijos de rutas)
    http/        httpClient (request), httpError, mock (withMock), url (withQuery)
    styles/      tokens.css y global.css
```

## Convenciones

- Cada carpeta de `src/modules` es autónoma y los módulos no se importan entre sí. Para sumar un
  módulo: crear la carpeta y agregar **una entrada** en `src/app/modules.tsx`; el router y el menú
  salen de esa lista. Detalle en `src/modules/README.md`.
- Todo acceso al backend pasa por `withMock(datosMock, () => request<T>(ruta))`. Con los mocks
  activos no se hace ninguna llamada real.
- Las pantallas con datos mock se rotulan con `<MockBanner />` (el layout lo muestra globalmente).
- Estilos con CSS Modules y variables de `tokens.css`, sin librería de UI.
- TypeScript con `verbatimModuleSyntax` y `erasableSyntaxOnly`: usar `import type` para tipos y no
  usar enums ni parameter properties (por eso los estados son uniones de literales).
- Las pruebas viven junto al código (`*.test.ts` / `*.test.tsx`) y se importan desde `vitest`.

## Estado y límites

- **Sin integración real:** ningún servicio llama al backend mientras `VITE_USE_MOCKS` no sea `false`.
- **Contratos en borrador:** los tipos, rutas y mocks salen del borrador de contratos del frontend
  (`docs/sprint04/contratos-frontend/` en `shipment-service`, rama `feature/71-contratos-frontend`),
  pendiente de aprobación e integración. Los prefijos de ruta están en `src/shared/config/api.ts`.
  Esta base no acredita contrato definitivo ni integración: eso lo validan S04-01 y S04-04 a S04-12.
- **Sin sesión:** no hay login real, almacenamiento de token, interceptor `Authorization`, guards ni
  manejo de 401/403 (corresponde a S04-04). Las páginas de cada módulo son placeholders.
- **Sin proxy ni Docker:** el proxy de Vite hacia el gateway y el Dockerfile con nginx quedan
  pendientes y fuera de esta base.
- **Pruebas:** son de humo (layout, navegación, rótulo de mocks y servicios sin red). Se probó solo
  en Windows 10 con Node 20.19.0 y npm 10.8.2.
