# Módulos

Cada carpeta de `src/modules` es un módulo autónomo (páginas, servicios, tipos y mocks propios).
Los módulos no se importan entre sí: lo compartido va en `src/shared`.

## Estructura de un módulo

```
src/modules/<nombre>/
  <Nombre>Page.tsx        página (por ahora, placeholder)
  types.ts                modelos
  mocks/<nombre>.mock.ts  datos provisionales
  services/<nombre>Service.ts
```

## Cómo agregar un módulo

1. Crear `src/modules/<nombre>/` con su página, por ejemplo `<Nombre>Page.tsx`.
2. Agregar una entrada en `src/app/modules.tsx`. El router y el menú se actualizan solos.

## Cómo consumir un servicio

Todo acceso al backend pasa por `withMock`: devuelve datos provisionales mientras los mocks estén
activos (`VITE_USE_MOCKS=true`) y ejecuta la llamada real cuando se desactivan. Las rutas se arman
con los prefijos de `src/shared/config/api.ts`.

```ts
// src/modules/couriers/services/courierService.ts
import { API_PREFIX } from '../../../shared/config/api'
import { request } from '../../../shared/http/httpClient'
import { withMock } from '../../../shared/http/mock'
import { withQuery } from '../../../shared/http/url'
import { repartidoresMock } from '../mocks/couriers.mock'
import type { EstadoRepartidor, Repartidor } from '../types'

const BASE = `${API_PREFIX.courier}/repartidores`

export function listarRepartidores(estado?: EstadoRepartidor): Promise<Repartidor[]> {
  return withMock(repartidoresMock, () => request<Repartidor[]>(withQuery(BASE, { estado })))
}
```

Las pantallas que muestren datos mock deben rotularlos con `<MockBanner />`. Los tipos, rutas y
mocks son provisionales (borrador de contratos del frontend) hasta que se apruebe la integración.
