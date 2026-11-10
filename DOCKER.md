# Imagen frontend · S04-10 / issue #8

Preparada sobre la base React y la configuración de desarrollo de DiazGab,
integradas mediante [#11](https://github.com/LogiTrack-Atom/logitrack-frontend/pull/11)
y [#14](https://github.com/LogiTrack-Atom/logitrack-frontend/pull/14) en develop
`d6a59a839acf14a2e73a999cb00ac3dcd19a0a61`. Nuestra rama conserva sus commits y
autores y agrega exclusivamente los seis archivos de la entrega Docker. La PR #12
está preparada para revisión sobre esa base integrada. Host/TLS y accesos reales
siguen pendientes según los límites declarados en #14.

## Construcción reproducible

```sh
docker build -t logitrack-frontend:sprint04-local .
```

La etapa build usa `npm ci --no-audit --no-fund` con el lockfile versionado y compila
TypeScript/Vite. Las bases oficiales se fijan por digest, sin depender de la próxima
resolución de un tag:

- `node@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8`
- `nginx@sha256:583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311`

Se admiten dos build-args públicos: `VITE_API_BASE_URL` (vacío por defecto) y
`VITE_USE_MOCKS` (`true` por defecto). Quedan compilados en JavaScript; modificarlos
requiere reconstruir. No pasar secretos por argumentos o variables VITE_. El
.env.example de la base no se incluye en el contexto ni se carga durante este build.
El runtime solo recibe assets estáticos y configuración Nginx, sin Node, npm,
node_modules, código fuente de la aplicación, archivos de entorno o claves.

Con base vacía, los módulos deben utilizar las rutas públicas
`/applications/apishipment/api/v1`, `/applications/apicourier/api/v1` y
`/applications/apisecurity/api/v1`. Para un Gateway cross-origin se puede compilar
su origen público, con la allowlist CORS y los contratos previamente acordados.
No habilitar integración real por cambiar un flag: G0, autenticación y aceptación
funcional conservan sus tareas pendientes.

## Ejecución y configuración del proxy

Prueba visual autónoma con mocks (el destino 127.0.0.1:9 es deliberadamente
inalcanzable dentro del contenedor; las llamadas API devolverán 502):

```sh
docker run --rm -d --name logitrack-frontend-s04 \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --cap-drop ALL --security-opt no-new-privileges \
  -p 127.0.0.1:8080:8080 \
  -e GATEWAY_UPSTREAM=http://127.0.0.1:9 \
  logitrack-frontend:sprint04-local
```

Para el laboratorio integrado, conectar el contenedor a la red de Gateway y
configurar `GATEWAY_UPSTREAM=http://api-gateway:8066`, o su destino real acordado.
Esta variable es obligatoria y solo admite origen HTTP/HTTPS, opcionalmente puerto
válido, sin ruta, slash final, credenciales, query, fragmento o directivas Nginx.
La validación falla antes de iniciar ante valores inválidos y no registra el valor.
La sustitución de plantilla se limita a GATEWAY_UPSTREAM; conserva $uri/$http_host.
Con upstream HTTPS se habilita SNI y verificación contra CA del sistema.

Nginx escucha en 8080 como usuario nginx (UID 101 en la plataforma probada), con
PID, configuración generada y temporales en /tmp. El `COPY --chmod` garantiza que
el validador sea ejecutable en la imagen. Puede ejecutarse con las restricciones
anteriores. `/healthz` y el HEALTHCHECK verifican el servidor estático, no la salud
del Gateway ni de las bases.

El proxy conserva `/applications/...` íntegro al enviarlo a Gateway; este retira
sus dos primeros segmentos según su contrato. No se agregan cabeceras CORS aquí.
Los códigos/cuerpos de API se conservan sin fallback de SPA; assets inexistentes,
`/applications` y rutas antiguas `/api/...` devuelven error, no index.html.
Las rutas de navegación SPA sí usan fallback. Los assets con hash se cachean como
inmutables; index.html se sirve con no-store.

El origen/TLS público y el destino final se confirmarán con Gab en #2. El TLS de
entrada puede terminar en el reverse proxy del hosting; no copiar su clave privada
a esta imagen. La coordinación de red/Compose y release continúa en S04-11/S04-13.
No se publicó una imagen de release ni se desplegó sobre el servidor del equipo.

## Verificación ejecutada · 2026-11-09

Build de imagen y compilación TypeScript/Vite aprobados con el lockfile de Gab.
Lint y 11 pruebas Vitest de Gab aprobados dentro de la misma etapa build:

```sh
docker build --target build -t logitrack-frontend:sprint04-builder .
docker run --rm logitrack-frontend:sprint04-builder npm run lint
docker run --rm logitrack-frontend:sprint04-builder npm test
```

Se comprobaron aislamiento del runtime y exclusión de archivos privados de ensayo.
La aceptación usó la imagen final con filesystem read-only, tmpfs /tmp, capacidades
retiradas y no-new-privileges, un Gateway real de laboratorio (código de su PR #9)
y un proveedor HTTP ficticio. No accedió a datos ni servicios compartidos.

| Verificación | Resultado |
| --- | --- |
| Usuario y HEALTHCHECK | UID 101, healthy |
| Deep links /shipments, /couriers, /login y ruta desconocida | HTML SPA 200; React resuelve la navegación |
| Assets del build / asset inexistente | 200 con cache immutable / 404 |
| Navegador: entrada directa en Envíos, navegación y recarga en Repartidores | Aprobado; mocks rotulados |
| Negocio anónimo a través del proxy | 401 de Gateway |
| PATCH con JWT efímero a través del proxy | 200 del proveedor; método, cuerpo, Bearer y ruta conservados |
| API con ID inexistente | 404 JSON, sin index.html |
| Gateway inalcanzable | 502, sin index.html; health estático no implica backend disponible |
| Upstream ausente o inválido | Siete configuraciones rechazadas antes de iniciar |

Imagen local efectivamente probada: `sha256:75f634f1cf9e48711bbf700fe49b515e4dea2a6c21155e3a0a17b75cdd9ff16a`.
La prueba de proxy no acredita reglas de negocio, persistencia o autorización de
pertenencia del dominio. HTTPS upstream está configurado con verificación, pero
este ensayo de transporte usó HTTP en loopback. No se afirma aceptación de arm64
ni del host remoto. Los contenedores previos se conservaron y los recursos propios,
servidores y material criptográfico efímero fueron retirados.

Pendientes de despliegue/aceptación completa: confirmar el host/TLS y accesos reales
descritos en #14, y reconciliar contratos/ADR y G0. Las PR #11 y #14 ya están
integradas. La imagen está preparada para revisión; no se declara despliegue sobre
el host ni aceptación de negocio. La auditoría diferida conserva su estado.

### Sincronización con la base integrada

Nuestra rama incorpora la base final mediante la
[PR técnica #15](https://github.com/LogiTrack-Atom/logitrack-frontend/pull/15), sin
reescribir historia ni modificar la rama de Gab. Tras incorporar su configuración
de API del mismo origen y proxy de Vite, se verificaron nuevamente build, lint y
11 pruebas Vitest. El filesystem y la configuración del runtime reconstruido son
idénticos a los que pasaron la aceptación HTTP/navegador anterior: se reutiliza esa
evidencia por equivalencia comprobada. develop no recibe cambios desde nuestra
rama hasta que se revise e integre la PR #12.
