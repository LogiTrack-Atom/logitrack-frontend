# Integración por Gateway — issue #9

## Configuración

Por defecto `npm run dev` usa datos ficticios. Para conectar servicios locales:

```bash
VITE_USE_MOCKS=false DEV_GATEWAY_URL=http://127.0.0.1:8066 npm run dev
```

`VITE_API_BASE_URL` vacío conserva el mismo origen y el proxy de Vite reenvía
`/applications/...` íntegro. Reiniciar Vite tras cambiar las variables.
Para un origen distinto, configurar su base explícita y la allowlist CORS del Gateway;
no usar comodines. Las variables `VITE_*` son públicas y se compilan en el bundle.

El adapter público realiza login, registro y `/auth/me`. Las pantallas privadas
usan `createSessionHttpClient`: Bearer en memoria, destinos limitados al Gateway,
cancelación por generación, descarte de respuestas tardías y logout ante 401/403.
Los facades heredados sin sesión siguen sin red. Un token mock no se envía al backend.
No se hacen reintentos automáticos de escritura.

## Verificación local del 10/11/2026

Entorno descartable `lt-s04-ui9`: tres MySQL vacíos, Config Server, Eureka,
Security, Courier, Shipment y Gateway. Imágenes Sprint03 locales; configuración
fijada en `configserver-ms@a08f95ee8fa0bf412fb30f68776e9a8794f94110`.
Gateway ejecutado con el JAR de `api-gateway@62918f8caa7a495a5c6fcba0512def70ace52443`
(PR #9 de ese repositorio) montado sobre la imagen de runtime Sprint03.
Este montaje no equivale a publicar una imagen nueva. No se utilizaron servicios públicos.

Navegador real, frontend sin mocks, proxy hacia `127.0.0.1:28066`:

- ADMIN: login, alta de cuenta REPARTIDOR, alta de ficha, lectura posterior,
  vínculo Courier y referencia Shipment confirmados.
- CLIENTE: registro, login y alta de envío; solo aparecen sus operaciones permitidas.
- ADMIN: asignación del repartidor; el envío sigue PENDIENTE y mantiene un evento.
- REPARTIDOR: listado asignado, cambios EN_RUTA y ENTREGADO; historial con tres eventos.
  Consulta de ficha propia y disponibilidad ACTIVO.
- Otro CLIENTE: listado vacío y consulta del tracking ajeno rechazada; el 403 real
  devuelve al login. Atrás/adelante no recuperan la pantalla privada.
- Recarga: requiere login de nuevo. Registro real muestra un mensaje sin rotularlo simulado.

Regresión reproducible de API: `scripts/check_gateway.py`, Python estándar sin dependencias.
Requiere `S04_GATEWAY_URL` de loopback, `S04_ADMIN_EMAIL` y `S04_ADMIN_PASSWORD`
entregados por entorno privado. Crea identidades y recursos ficticios nuevos en cada corrida;
no usar sobre datos reales. No guarda tokens ni imprime credenciales o cuerpos de error.

Resultado: **8 escenarios, 38 requests HTTP, 57 aserciones**. Incluye lecturas posteriores,
rechazos 401/403, pertenencia por UUID/tracking, asociación parcial, PUT idéntico de referencia,
asignación sin transición, entrega e historial. La repetición de ese PUT no acredita
idempotencia de POST ni rollback distribuido. La disponibilidad no reserva capacidad.

Frontend: **188 pruebas Vitest en 17 archivos**, ESLint sin advertencias y build correctos.
Son pruebas unitarias/de componentes y no se suman al conteo de escenarios API.
CORS real del Gateway: 2 preflight y 4 aserciones; origen local explícito permitido (200) y origen ajeno rechazado (403), sin cabecera de autorización de origen.
No se ejecutaron pruebas Java ni scanners en esta entrega. Las pruebas de respuestas
fuera de sesión, vencimiento y escrituras inciertas continúan cubiertas por las suites
locales; no se presentan como fallas reales inyectadas en los servicios durante esta corrida.

## Pendientes para cerrar la aceptación completa

Integrar la cadena de PR del frontend y repetir el humo sobre `develop` y la imagen final
con Nginx (#8); confirmar hosting y conectividad pública; ejecutar los escenarios restantes
de la matriz #9 que no figuran arriba, incluida la ampliación de errores y recuperación.
La consigna pide almacenamiento seguro y persistencia del contexto JWT, sin fijar aquí
un mecanismo concreto: la sesión en memoria cumple la navegación SPA pero no persiste
al recargar. La aceptación de esa interpretación docente sigue explícita antes de cerrar
el criterio de autenticación; no se declara validada por esta prueba técnica.

La auditoría S04-00 se cerró como alcance diferido y no es una dependencia de este trabajo.
