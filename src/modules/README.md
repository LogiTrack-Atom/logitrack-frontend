# Módulos

Cada carpeta de `src/modules` es un módulo autónomo (páginas, servicios, tipos y mocks propios).
Los módulos no se importan entre sí: lo compartido va en `src/shared`.

## Cómo agregar un módulo

1. Crear `src/modules/<nombre>/` con su página, por ejemplo `<Nombre>Page.tsx`.
2. Agregar una entrada en `src/app/modules.tsx`. El router y el menú se actualizan solos.

## Cómo consumir un servicio

Todo acceso al backend pasa por `withMock`: devuelve datos provisionales mientras los mocks estén
activos (`VITE_USE_MOCKS=true`) y ejecuta la llamada real cuando se desactivan.

```ts
// src/modules/couriers/services/couriersService.ts
import { request } from '../../../shared/http/httpClient'
import { withMock } from '../../../shared/http/mock'
import { couriersMock } from '../mocks/couriers.mock'
import type { Courier } from '../types'

export function listCouriers(): Promise<Courier[]> {
  return withMock(couriersMock, () => request<Courier[]>('/couriers'))
}
```

Las pantallas que muestren datos mock deben rotularlos con `<MockBanner />`.
