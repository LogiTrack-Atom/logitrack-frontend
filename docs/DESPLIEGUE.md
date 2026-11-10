# Despliegue y traspaso de la base (S04-03 / #2)

## Estado

La demostración es el modo predeterminado. Para conectar las pantallas de autenticación, envíos, repartidores y administración al backend, definir `VITE_USE_MOCKS=false` y configurar el Gateway. Los requests privados usan la sesión en memoria y los prefijos `/applications/...`. La auditoría S04-00 está cerrada como alcance diferido y no condiciona esta integración.

El hosting público continúa pendiente de confirmar. La verificación local se registra en `INTEGRACION.md`; no equivale a un despliegue público.

## Origen y destino

    Navegador --HTTPS--> reverse proxy del hosting --HTTP--> contenedor frontend (Nginx, 8080)
                                                                  |
                                                  /applications/... (íntegro)
                                                                  v
                                                  API Gateway (GATEWAY_UPSTREAM)

- El navegador usa un único origen. No hace falta CORS por este camino.
- El Gateway recibe `/applications/...` completo y quita sus dos primeros segmentos.
- Destino del Gateway en laboratorio: `http://api-gateway:8066`. Fuera de Docker: `http://localhost:8066`.
- TLS termina en el reverse proxy del hosting. La clave privada no entra a la imagen ni al repositorio.
- Host y dominio públicos: **pendiente de confirmar en #2**.
- La imagen (Dockerfile, Nginx, validación del destino, healthcheck) se documenta en `DOCKER.md` (issue #8, rama `feature/8-docker-frontend`).

## Variables (todas públicas, sin secretos)

| Variable | Dónde | Valor por defecto | Uso |
|---|---|---|---|
| `VITE_API_BASE_URL` | build | vacío (mismo origen) | Base de las llamadas al backend |
| `VITE_USE_MOCKS` | build | `true` | Solo `false` desactiva los mocks |
| `DEV_GATEWAY_URL` | `npm run dev` | `http://localhost:8066` | Destino del proxy de Vite; no entra al bundle |
| `GATEWAY_UPSTREAM` | runtime Docker | obligatoria | Destino del Gateway en Nginx (ver `DOCKER.md`) |

Las variables `VITE_*` quedan compiladas en el JavaScript: no poner claves, contraseñas ni JWT. Los accesos al host y al laboratorio se entregan al equipo por canal privado, nunca en el repositorio.

## Arranque local reproducible

Requisitos: Node 20.19 o superior (`engines` del `package.json`).

    npm ci
    npm run dev

Abre en `http://localhost:5173`. Con mocks activos no hace falta ningún backend. Para probar contra un Gateway local, levantarlo en el 8066 (o exportar `DEV_GATEWAY_URL`) y poner `VITE_USE_MOCKS=false` en un `.env` local, que está ignorado por git.

Deep links: `/shipments`, `/couriers` y `/login` cargan directo por URL.

## Despliegue y rollback

1. Construir la imagen con una etiqueta que identifique la versión (por ejemplo el SHA corto): `docker build -t logitrack-frontend:SHA .`
2. Levantar el contenedor nuevo con `GATEWAY_UPSTREAM` apuntando al Gateway, siguiendo `DOCKER.md`, sin borrar el anterior.
3. Verificar `/healthz` (solo prueba el servidor estático, no el Gateway) y un deep link.
4. **Rollback:** detener el contenedor nuevo y volver a levantar la imagen anterior con su etiqueta. Conservar siempre la etiqueta previa; no reutilizar etiquetas.

## Verificación de esta entrega (2026-11-09)

Entorno: Windows 10, Git Bash, Node v20.19.0, Docker 29.7.2. Vite 8.3.7, Vitest 4.1.11.

| Prueba | Resultado |
|---|---|
| `npm ci` | OK |
| `npm run lint` | sin errores |
| `npm run build` | OK, 41 módulos |
| `npm test` | 11 de 11 pruebas |
| `npm run dev`: `/shipments`, `/couriers`, `/login` | 200 los tres |
| Proxy de Vite con Gateway simulado | `/applications/apishipment/api/v1/envios?estado=PENDIENTE` llega íntegro, método GET |

Límites: no se probó contra el Gateway ni los servicios reales, ni sobre un host remoto, ni con TLS. La imagen Docker se verifica en la issue #8. `npm audit` informa 12 vulnerabilidades moderadas en dependencias de desarrollo.
