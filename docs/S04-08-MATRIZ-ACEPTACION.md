# S04-08 — Matriz de aceptación y evidencia

> Estado: **Implementación local propuesta**. No acredita S04-01 ni merges de S04-02/04/05 y no representa una prueba real de integración.

## Backend de referencia

- Courier develop, árbol `003003d619d0479bc0577d839a580e61e51a8f0b` (consultado 2026-11-09).
- Gateway `/applications/apicourier/api/v1/repartidores` → StripPrefix=2 → Courier `/api/v1/repartidores`.
- RepartidorRequest: `nombre`, `tipoVehiculo` (ambos @NotBlank, @Size(255)).
- RepartidorResponse: `id`, `nombre`, `tipoVehiculo`, `estado`, `createdAt`, `updatedAt`.
- Disponibilidad: `repartidorId`, `estado`, `disponible`; **no reserva** y solo refleja ACTIVO.

## Casos a probar en entorno real del equipo (no ejecutados aquí)

| Caso | Actor | Acción | Resultado esperado |
|---|---|---|---|
| C01 | ADMIN | GET listado sin filtro | 200 `RepartidorResponse[]`; UI tabla o vacío |
| C02 | ADMIN | GET listado estado=INACTIVO | 200 solo INACTIVO; no filtrar únicamente en memoria |
| C03 | ADMIN | POST nombre + tipoVehiculo válidos | 201 con ID; posterior GET confirma ACTIVO |
| C04 | ADMIN | POST inválido (blanco o >255) | Validación local y/o 400 visible; sin aceptación falsa |
| C05 | ADMIN | PUT nombre/tipoVehiculo | 200 y posterior GET confirma valores, mismo ID y estado |
| C06 | ADMIN | PATCH ACTIVO→INACTIVO | 200 y posterior GET confirma; disponibilidad `false` |
| C07 | ADMIN | PATCH INACTIVO→ACTIVO | 200 y posterior GET confirma; disponibilidad `true` |
| C08 | ADMIN | GET /{id}/disponibilidad | 200 solo lectura; no genera reserva |
| C09 | CLIENTE | Navegar /courier y /courier/{id} | Guard redirige, sin GET al backend; acceso directo con Bearer CLIENTE: 403 |
| C10 | REPARTIDOR vinculado | GET su ID y su disponibilidad | 200 y vista de solo lectura |
| C11 | REPARTIDOR vinculado | GET ID ajeno | 403 desde backend, sesión invalidada por cliente HTTP |
| C12 | REPARTIDOR | GET /repartidores o POST/PUT/PATCH | No hay botones; acceso forzado a backend: 403 |
| C13 | ADMIN | GET recurso inexistente | 404 con mensaje útil |
| C14 | ADMIN | Error 409/422 | Mensaje seguro, sin éxito y sin exposición de token |
| C15 | ADMIN | Error 502/503 o red caída | UI legible, no repetición automática de escritura |
| C16 | ADMIN | POST devuelve 202 | No tratar como éxito, bloquear segundo POST hasta reconciliar |
| C17 | Cualquier rol | Logout y navegación atrás/adelante | Sin recuperar datos/acciones privadas; JWT no persistido |
| C18 | ADMIN | Buscar botón DELETE | Inexistente; solo cambio estado PATCH |

Registrar para cada caso: URL/método, rol, status HTTP, resumen sanitizado del cuerpo, captura sin JWT, versión/build/commit de cada servicio y fecha. **No publicar credenciales ni tokens.**

## Dependencias abiertas a conciliar

1. [S04-01, shipment #71](https://github.com/LogiTrack-Atom/shipment-service/issues/71): contrato definitivo y ADR.
2. [S04-02, frontend #1](https://github.com/LogiTrack-Atom/logitrack-frontend/issues/1): base, estilos, router, lockfile.
3. [S04-04, frontend #3](https://github.com/LogiTrack-Atom/logitrack-frontend/issues/3): AuthProvider, exp/skew, logout.
4. [S04-05, frontend #4](https://github.com/LogiTrack-Atom/logitrack-frontend/issues/4): HTTP seguro, roles, errores y cachés.

**No cerrar issue #6** hasta validar dependencias e integración real. El requisito de PR es trabajo futuro autorizado del equipo; no se creó ningún PR.
