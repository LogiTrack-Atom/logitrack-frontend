# Módulo Shipment — S04-07

> Estado actualizado en #9: el modo real se habilita con `VITE_USE_MOCKS=false` y se verificó por Gateway. S04-00/G0 está retirado como requisito. Ver [resultados y pendientes vigentes](docs/INTEGRACION.md). Las cantidades de pruebas y ramas descritas abajo corresponden a la entrega original de cada módulo.

Implementación provisional de [frontend#5](https://github.com/LogiTrack-Atom/logitrack-frontend/issues/5), sobre `feature/4-http-roles-errores` (`2f744ff`), dependiente de PR #17 y de PR #16. La rama se creó desde Development de la issue. La PR usa esa base temporal para mostrar únicamente el módulo nuevo; no fusionar en ella. Después de integrar las dependencias, cambiar la base a `develop` antes de aceptar/mergear. `develop` permanece sin cambios.

## Pantallas y flujo

- Lista por identidad con filtro de estado y estados de carga, vacío y error. Consultas por UUID o tracking y detalle con direcciones, medidas, repartidor e historial.
- CLIENTE/ADMIN: alta con contacto y direcciones obligatorias. Se construye solo el DTO permitido: sin identidad, rol, estado ni repartidor seleccionables. El peso admite 7 enteros/3 decimales y dimensiones 8 enteros/2 decimales, positivos. Se conservan strings hasta validar; no se redondea ni acepta coma/exponente silenciosamente.
- ADMIN: asignación síncrona y cancelación de un envío PENDIENTE, con confirmación explícita. Asignar conserva estado e historial. La disponibilidad simulada no reserva capacidad.
- ADMIN/REPARTIDOR: PENDIENTE con repartidor asignado → EN_RUTA → ENTREGADO. El panel REPARTIDOR muestra sus asignaciones; no permite altas, asignaciones ni cancelación. Los estados terminales no presentan más transiciones.
- La UI espera respuestas confirmadas y vuelve a consultar datos; no aplica cambios optimistas. Un bloqueo inmediato evita doble submit. Una falla de red o respuesta inválida en escritura no se interpreta como éxito ni se reintenta automáticamente. El usuario debe reconciliar listado/detalle antes de decidir otra operación. Esto no ofrece idempotencia de altas backend.

## Reutilización de la base y aislamiento

`createShipmentService` reutiliza los DTO, prefijos, rutas y convenciones de los servicios de Gab. Todas las operaciones de la pantalla pasan por el cliente privado de #4, incluida la simulación. Las funciones mock heredadas conservan sus firmas para compatibilidad, pero no se usan como servidor con estado del módulo nuevo.

Se combinan señales de cancelación del componente y sesión. Cambiar filtro/selección o salir de la pantalla descarta resultados tardíos. Logout desmonta el árbol privado; datos de una generación anterior no vuelven a la UI. La búsqueda por tracking sigue protegida y no se considera una consulta pública. Ocultar botones no reemplaza autorización ni pertenencia backend.

## Servidor simulado

`shipmentServer.ts` reutiliza los fixtures ficticios existentes, corrigiendo la coherencia inicial en la copia de trabajo: un envío PENDIENTE empieza sin asignación y con un evento. Mantiene una base de datos ficticia en memoria de la pestaña, compartida entre perfiles de demostración, con permisos por usuarioId/sub y repartidorId de dominio distintos. No deduce pertenencia por el email de contacto.

Los perfiles de demostración son `cliente@example.com`, `admin@example.com` y `repartidor@example.com`, con contraseña ficticia no verificada. Sus etiquetas opacas de token no son JWT ni credenciales reales. El selector de perfil nunca se envía al backend real: solo el adapter mock interpreta los correos de demostración. Registro simulado no crea cuentas persistentes.

La base simulada permanece al cambiar de perfil, como un servidor de demostración; no es un caché de UI. Recargar reinicia todos sus datos y exige login. La versión integrada con #6 usa el registro Courier compartido: admite altas y cambios ACTIVO/INACTIVO y verifica su estado vigente al asignar e iniciar EN_RUTA (ver COURIER.md). Las fichas nuevas no se asocian automáticamente: el flujo #7 (ADMIN.md) registra explícitamente los vínculos Courier y Shipment. Un envío nuevo se vincula al usuario creador en esta simulación; no se pretende reproducir todos los escenarios de asociación administrativa de identidades ni el proveedor Courier real. Cada comando valida permisos/reglas antes de mutar; el test de rechazo comprueba que envío e historial no cambien.

## Estado de integración y hosting


Las issues iniciales #1/#2 de Gab están integradas. Se verificaron localmente `npm ci` y `npm run dev`. Según su actualización al equipo, el hosting aún está en evaluación por recursos disponibles; no hay evidencia de despliegue remoto listo y no se configuró otro hosting ni Minikube con esta entrega.

## Verificación

Node 24.15.0 y package-lock.json existente. Build, lint, `git diff --check` y 132 pruebas aprobados (108 previas, 24 adicionales). Cubren validaciones de escala/direcciones, DTO sin identidad elegible, pertenencia independiente del correo, rechazo sin efectos parciales, estados terminales, cancelación, doble submit, resultado incierto y respuestas tardías.

En navegador local se completó CLIENTE crea → ADMIN asigna → REPARTIDOR EN_RUTA/ENTREGADO, conservando un evento al asignar y exactamente tres al entregar. Se verificó la presentación del detalle y el cierre de sesión. Los tests de componentes cubren además filtros, tracking, panel por rol e historial. Todo esto usa datos ficticios y no sustituye aceptación end-to-end contra Gateway/Courier/Shipment reales. No se modificó Java ni se ejecutaron suites backend.

## Integración MQ — #10

La base asíncrona fue integrada por DiazGab en PR25. Se habilita únicamente con
`VITE_ASYNC_ASSIGNMENT=true`, `VITE_USE_MOCKS=false`, rol ADMIN y un envío PENDIENTE.
El Dockerfile acepta ambos argumentos de construcción; no son secretos. La imagen P0
mantiene el flag apagado y sus tags/digests no se reemplazan.

Un 202, incluso al reconciliar una operación ya APPLIED, inicia seguimiento: confirmar
requiere GET de la operación y GET del envío con el UUID de repartidor esperado. Un 503
del proxy puede ocultar un commit; el reintento manual conserva Idempotency-Key como los
otros 5xx inciertos. El sondeo tiene backoff y límite; no reenvía POST automáticamente.
La confirmación actualiza el detalle y el listado sin desmontar el panel. La sesión y
AbortSignal descartan resultados tardíos tras logout.

`npm test`: 220 pruebas aprobadas, incluidas las 11 originales del flujo y 5 de integración
adicionales (replay terminal, contraste del envío, lectura indisponible, logout del
componente y reconciliación ante 503). `npm run lint` y `npm run build` aprobados.
La aceptación contra Compose con RabbitMQ y sus límites queda en shipment-service#80.
