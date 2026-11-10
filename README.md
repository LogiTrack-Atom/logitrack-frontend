# LogiTrack — Sprint 04 · Issue #6 (S04-08 Módulo Courier)

**Entrega local independiente, sin cambios en GitHub.** Implementa la issue
[LogiTrack-Atom/logitrack-frontend#6](https://github.com/LogiTrack-Atom/logitrack-frontend/issues/6)
y contiene una versión ejecutable de React 19 + TypeScript + Vite con el módulo Courier integrado.

## Estado de dependencias consultadas el 09/11/2026

| Dependencia | Estado observado | Cómo se trata en esta entrega |
| --- | --- | --- |
| [Shipment #71 — S04-01 contratos](https://github.com/LogiTrack-Atom/shipment-service/issues/71) | Abierta | Rutas y DTO tomados del `courier-service@develop` como baseline **provisional**. No se inventan cambios backend ni se declara contrato aprobado. |
| [Frontend #1 — S04-02 base React](https://github.com/LogiTrack-Atom/logitrack-frontend/issues/1) | Abierta | React + TS + Vite, router, layout, componentes y placeholders incluídos de manera autocontenida. **No es un merge** de la futura rama del responsable. |
| [Frontend #3 — S04-04 JWT](https://github.com/LogiTrack-Atom/logitrack-frontend/issues/3) | Abierta | Adaptador AuthProvider propio: token **solo memoria**, login/me y guard de rol. Debe conciliarse con el código aprobado por el responsable. |
| [Frontend #4 — S04-05 HTTP/roles](https://github.com/LogiTrack-Atom/logitrack-frontend/issues/4) | Abierta | Axios al Gateway, 401/403, errores legibles y aborto/invalidación por sesión. Debe conciliarse con la implementación definitiva. |

Al consultar el repositorio remoto Frontend solo existía la rama `main` con un README (árbol `973e697672295b05b6c583530f900c90ca323a90`). Por eso **no se presupone que las dependencias estén integradas**. Esta carpeta no realiza commits ni PR.

## Alcance S04-08 implementado

- **ADMIN:** `GET /api/v1/repartidores` con `?estado=ACTIVO|INACTIVO`, vacío/cargando/error, alta `POST`, detalle `GET /{id}`, edición `PUT /{id}`, cambio `PATCH /{id}/estado`, disponibilidad `GET /{id}/disponibilidad`.
- **REPARTIDOR:** consulta individual por UUID **solo lectura**; nunca usa la lista general. No infiere un UUID de dominio desde el `sub` de Security. La pertenencia **se valida en el backend** (`@repartidorAccess.puedeConsultar`).
- **CLIENTE:** no aparece la navegación y el guard rechaza `/courier` y `/courier/:id`. Las restricciones de UI **no sustituyen** la autorización backend.
- **Sin DELETE:** el backend no expone eliminación de repartidores. El estado se cambia explícitamente a ACTIVO/INACTIVO.
- El adaptador valida los DTOs al recibirlos, inclusive la coherencia `disponible === (estado === 'ACTIVO')` y el UUID consultado.
- Tras `POST 201`, `PUT 200` o `PATCH 200` hace **GET de comprobación**. Una escritura con `202` o con comunicación incierta **no muestra éxito** ni reintenta automáticamente; ofrece reconciliación.
- Los mensajes de error se centralizan para 400/401/403/404/409/422/429/502/503, sin exponer claves ni trazas.
- Token solo en memoria, nunca en localStorage/sessionStorage ni cookies. Las sesiones anteriores se invalidan al salir; una recarga exige login.

## Contrato REAL observado en Courier `develop`

Rama consultada: `develop`, árbol Git `003003d619d0479bc0577d839a580e61e51a8f0b`.
Archivos de referencia:
- [`RepartidorController.java`](https://github.com/LogiTrack-Atom/courier-service/blob/develop/src/main/java/com/logitrack_atom/courier_service/controller/RepartidorController.java)
- [`SecurityConfig.java`](https://github.com/LogiTrack-Atom/courier-service/blob/develop/src/main/java/com/logitrack_atom/courier_service/config/SecurityConfig.java)
- [`RepartidorAccess.java`](https://github.com/LogiTrack-Atom/courier-service/blob/develop/src/main/java/com/logitrack_atom/courier_service/security/RepartidorAccess.java)
- [`RepartidorRequest.java`](https://github.com/LogiTrack-Atom/courier-service/blob/develop/src/main/java/com/logitrack_atom/courier_service/dto/request/RepartidorRequest.java)
- [`RepartidorResponse.java`](https://github.com/LogiTrack-Atom/courier-service/blob/develop/src/main/java/com/logitrack_atom/courier_service/dto/response/RepartidorResponse.java)
- [`DisponibilidadRepartidorResponse.java`](https://github.com/LogiTrack-Atom/courier-service/blob/develop/src/main/java/com/logitrack_atom/courier_service/dto/response/DisponibilidadRepartidorResponse.java)

Prefijo de ruta a través del Gateway **local**: `/applications/apicourier/api/v1/repartidores` (`StripPrefix=2`). Nunca enviar JWT directamente a URLs externas o direcciones internas de contenedores desde el navegador.

| Método / ruta dentro del servicio | Rol autorizado | JSON |
| --- | --- | --- |
| GET `/api/v1/repartidores?estado=ACTIVO` | ADMIN | `RepartidorResponse[]` |
| POST `/api/v1/repartidores` | ADMIN | `{ "nombre": "...", "tipoVehiculo": "..." }` → 201 |
| GET `/api/v1/repartidores/{id}` | ADMIN y REPARTIDOR propietario | `RepartidorResponse` |
| PUT `/api/v1/repartidores/{id}` | ADMIN | `{ "nombre": "...", "tipoVehiculo": "..." }` |
| PATCH `/api/v1/repartidores/{id}/estado` | ADMIN | `{ "estado": "INACTIVO" }` |
| GET `/api/v1/repartidores/{id}/disponibilidad` | ADMIN y REPARTIDOR propietario | `{ "repartidorId": "UUID", "estado": "ACTIVO", "disponible": true }` |

**No existe `/repartidores/me`:** el repartidor autenticado debe ingresar el UUID de su ficha proporcionado por un ADMIN. No se realiza un listado ni búsqueda indiscriminada para encontrarlo. El backend verifica el vínculo `usuarioId` (JWT `sub`) con la identidad Courier correspondiente.

## Ejecutar en Windows / IntelliJ

```powershell
cd C:\Users\Dell\IdeaProjects\logitrack-atom\logitrack-frontend-s04-08
npm install
npm run dev
```

Abrir **http://127.0.0.1:5173**. Para login y datos reales, levantar Gateway, Security, Eureka, Courier y Config Server; desde la SPA, Vite reenvía `/applications/**` al Gateway `http://127.0.0.1:8066` usando el proxy en `vite.config.ts`. Para cambiar el destino, configurar `LOGITRACK_GATEWAY_DEV_TARGET` en el proceso de Vite. La variable `.env` `VITE_API_BASE_URL=/` mantiene requests de mismo origen.

**Nota:** el `package-lock.json` se debe generar en la máquina con acceso a npm. No incluir secretos, tokens ni claves en `.env`, documentos, screenshots ni commits. El paquete no incluye node_modules.

## Verificación reproducible

```powershell
npm install
npm run typecheck
npm test
npm run build
npx playwright install chromium
npx playwright test e2e/courier.spec.ts
```

Una vez generado el lockfile, verificar desde copia limpia con `npm ci`. Pruebas incluidas:
- `tests/courier.contract.test.ts`: DTO, disponibilidad y matriz ADMIN/CLIENTE/REPARTIDOR.
- `tests/courier.operations.test.ts`: confirmación GET, 202 pendiente, corte de red sin duplicar, PUT/PATCH y 409.
- `e2e/courier.spec.ts`: mocks etiquetados para roles, filtro, disponibilidad, PATCH y rechazo de otro recurso.
- `e2e/auth.spec.ts`: flujo JWT y guards heredado de la versión local.

Estos tests con **mocks no son evidencia de integración real**. Para la aceptación definitiva hay que documentar un ensayo en Postman/navegador contra los microservicios y comprobar el usuario real asociado, cambios persistidos y 403 del backend. También faltan las aprobaciones y merges de las cuatro dependencias y la conciliación con sus implementaciones finales.

## Puntos de integración para el equipo

Si otros compañeros ya tienen la base S04-02/S04-04/S04-05 en su branch, aplicar solo estos puntos a **una copia local**:

1. Reutilizar `src/features/courier/contract.ts` y `operations.ts` (código aislado de React).
2. Adaptar `src/api/services.ts` para que `courierApi` use el cliente HTTP y autenticación central aprobados.
3. Adaptar `src/pages/Couriers.tsx` y `CourierDetail.tsx` a los componentes de la base del equipo.
4. Registrar `/courier` y `/courier/:id` con guard para `ADMIN`/`REPARTIDOR`, nunca `CLIENTE`.
5. Reejecutar las pruebas con el `develop` y contratos finalmente acordados.

La implementación de S04-08 no presupone permiso de modificación de los repositorios remotos. No crear rama, commit, push ni PR desde este paquete sin coordinación del equipo.

## Evidencia producida y límites

- Consulta del código real de Courier `develop` por GitHub el 09/11/2026.
- Revisión de issue #6 y las cuatro dependencias (todas abiertas en el momento de consulta).
- Validación sintáctica de TS/TSX realizada en este entorno mediante el compilador TypeScript disponible (no equivale a `tsc -b`).
- **No fue posible ejecutar npm install, typecheck, vitest, Playwright ni build** aquí porque DNS de `registry.npmjs.org` devolvió `EAI_AGAIN`. Deben ejecutarse en Windows/IntelliJ y guardar consola y versión de Node/npm como evidencia.
- No se desplegó la aplicación ni se probó contra un servidor real desde este entorno.
