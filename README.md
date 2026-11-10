# logitrack-frontend

> Actualización de sesión: la decisión del equipo permite recuperar el acceso al recargar mediante cookie HttpOnly de renovación, sin guardar JWT en Web Storage. Ver [sesión renovable](docs/SESION_RENOVABLE.md). Sustituye la política anterior de recarga de esta entrega.

Cliente web de LogiTrack Atom: gestión de envíos, repartidores y acceso por roles mediante API Gateway.

La aplicación incluye autenticación, navegación por roles y gestión de envíos, repartidores y asociaciones administrativas. Funciona con demostración sin red por defecto o con servicios reales mediante `VITE_USE_MOCKS=false`. Ver [integración](docs/INTEGRACION.md) y [despliegue](docs/DESPLIEGUE.md).

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
- Las pantallas privadas usan factories de servicio y `createSessionHttpClient`: token en memoria,
  cancelación por sesión y cierre ante 401/403. Los facades heredados sin sesión permanecen sin red.
- Las pantallas con datos mock se rotulan con `<MockBanner />` (el layout lo muestra globalmente).
- Estilos con CSS Modules y variables de `tokens.css`, sin librería de UI.
- TypeScript con `verbatimModuleSyntax` y `erasableSyntaxOnly`: usar `import type` para tipos y no
  usar enums ni parameter properties (por eso los estados son uniones de literales).
- Las pruebas viven junto al código (`*.test.ts` / `*.test.tsx`) y se importan desde `vitest`.

## Estado y límites

- Mocks por defecto; el modo real requiere Gateway y servicios disponibles. Los prefijos están en `src/shared/config/api.ts`.
- Sesión en memoria: recargar requiere autenticarse; no se guarda el JWT en almacenamiento del navegador. Cerrar sesión local no revoca un Bearer ya emitido.
- Los guards y menús ayudan a navegar; el backend controla roles y pertenencia de los recursos.
- El proxy de Vite conserva las rutas `/applications/...`; Docker se prepara en la issue #8.
- Hosting público y aceptación final del conjunto integrado en `develop`: pendientes.
- La auditoría S04-00 está cerrada como alcance diferido y no bloquea la integración funcional.
