# Cliente HTTP, roles y errores — S04-05

> Estado actualizado en #9: el modo real se habilita con `VITE_USE_MOCKS=false` y se verificó por Gateway. S04-00/G0 está retirado como requisito. Ver [resultados y pendientes vigentes](docs/INTEGRACION.md). Las cantidades de pruebas y ramas descritas abajo corresponden a la entrega original de cada módulo.

Entrega provisional de [frontend#4](https://github.com/LogiTrack-Atom/logitrack-frontend/issues/4), dependiente de la sesión de [PR #16](https://github.com/LogiTrack-Atom/logitrack-frontend/pull/16). La rama se creó desde Development de la issue usando `feature/3-auth-sesion` como origen (`0d0c2ab`), porque esa dependencia aún no está integrada. La PR se compara contra esa rama para mostrar solo el cambio de #4; deberá pasar a `develop` después de integrar #16. No se modificó `develop`.

## Destinos y credenciales

`gatewayUrl` acepta únicamente el origen configurado en `VITE_API_BASE_URL` (vacío para mismo origen) y los tres prefijos conocidos de seguridad, shipment y courier. Una base cross-origin debe ser un origen HTTP(S) sin ruta, credenciales, query ni fragmento. Se rechazan otros orígenes, rutas relativas ambiguas, prefijos parecidos, barras invertidas, segmentos de traversal, escapes ambiguos y caracteres de control antes de fetch.


`createSessionHttpClient` obtiene el token desde `SessionStore.runAuthenticated`. El consumidor no puede reemplazar Authorization. Combina la cancelación del consumidor y de la sesión; descarta resultados si cualquiera se cancela aunque el transporte ignore la señal. Un 401/403 de una generación vigente hace logout una vez: el guard desmonta los datos privados y redirige al login. Un error viejo no termina una sesión nueva. Login y registro públicos usan su adapter separado; un login fallido se muestra en el formulario sin reintento automático.

No existe un caché global de negocio. La UI privada usa estado local desmontado por el guard y generación de sesión; los módulos futuros no deben introducir cachés compartidos entre usuarios ni actualizar datos dentro del callback anterior a la validación de generación. Si se agrega un caché de consultas, su alcance y limpieza se deberán conectar a la sesión.

## Errores

`HttpError` conserva el estado HTTP y un mensaje fijo legible. ApiError, ProblemDetail, HTML y cuerpo vacío de error se clasifican por status sin consumir ni retener textos arbitrarios que pudieran reflejar contraseñas o datos sensibles. 400, 401, 403, 404, 409, 422, 502 y 503 tienen mensajes diferenciados. Otros códigos no exitosos también rechazan la promesa.

Una respuesta exitosa debe ser JSON válido; 204/205 permiten ausencia de cuerpo. Un 200 vacío o fallback HTML se considera respuesta inválida. Fallas de red y de lectura no producen éxito ni reintentos ciegos de escrituras; el mensaje indica verificar el resultado antes de repetir una operación de guardado. `RequestErrorNotice` presenta texto React accesible y omite cancelaciones, nunca interpreta HTML.

## Roles

La matriz provisional se tomó de los contratos #71: Inicio y Envíos para ADMIN/CLIENTE/REPARTIDOR; Courier para ADMIN/REPARTIDOR. CLIENTE no ve Courier y el acceso directo muestra una página de permiso insuficiente, sin cerrar una sesión válida. `Allowed` prepara presentación de acciones: crear envío ADMIN/CLIENTE, avanzar ADMIN/REPARTIDOR y administración exclusiva ADMIN. Las pantallas aún son placeholders: no se agregan acciones de negocio ficticias.

Pertenencia a un envío, asignación propia de un repartidor y autorización efectiva siguen siendo responsabilidad del backend. El rol REPARTIDOR no habilita el listado general de Courier; su futura pantalla solo podrá consultar su identidad/detalle permitidos, conforme a #6.

## Integración pendiente y consumo por módulos



## Verificación

Node 24.15.0, dependencias de package-lock.json. `npm run build`, `npm run lint`, `npm test` y `git diff --check` aprobados. Suite: 108 pruebas (44 previas y 64 adicionales), incluidas carreras 401/403, errores viejos, cancelación, restricción de destinos, respuestas erróneas y rutas/acciones por rol. Todo fetch de estas pruebas es simulado: no son aceptación de un backend real.

En navegador local se verificaron login CLIENTE, menú sin Courier, acceso directo denegado a Courier, regreso al inicio, navegación a Envíos y logout con historial privado bloqueado. ADMIN/REPARTIDOR y respuestas HTTP concurrentes se verificaron con pruebas de componentes/transporte. No se desplegó ni se ejecutaron suites backend.
