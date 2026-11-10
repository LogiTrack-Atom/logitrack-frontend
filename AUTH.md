# Autenticación y sesión — S04-04

Implementación provisional de [frontend#3](https://github.com/LogiTrack-Atom/logitrack-frontend/issues/3), sobre la base React de Gab integrada en `develop` (`d6a59a8`).

## Estado y límites

- El modo predeterminado continúa siendo mock. El perfil simulado siempre es CLIENTE (`cliente@example.com`); no valida contraseñas ni crea usuarios en el servidor. El banner lo indica.
- `activeAuthTransport` bloquea la autenticación si se desactivan los mocks: cambiar una variable de entorno no habilita integración real antes de G0. `gatewayAuthTransport` prepara los endpoints provisionales login, register y me; sus pruebas interceptan fetch y no acceden a un backend.
- G0 (shipment-service#70), contratos (shipment-service#71) y validación docente de la política de persistencia siguen pendientes. Esta entrega no acepta ni cierra #3 y no representa un despliegue.

## Ciclo de vida

`AuthProvider` crea un `SessionStore` por montaje de la aplicación. El token vive en un campo privado en memoria, fuera del snapshot React. No se guarda en Web Storage, cookies, parámetros de ruta ni logs. Las credenciales solo se envían desde el formulario; se vacía el campo de contraseña al iniciar el envío. El registro público no expone selección de rol.

Navegar por la SPA conserva la sesión. Recargar exige login. Esta decisión provisional debe ser validada por el profesor antes de aceptar la issue. No hay refresh token ni logout remoto en el contrato actual.

Para el transporte Gateway se exige `tokenType: Bearer`, duración positiva y un JWT con `exp` entero futuro y `sub` UUID coincidente con el id de `auth/me`. Leer claims en el navegador no verifica la firma ni sustituye la autorización del servidor. El token mock de la base de Gab no es un JWT: solo en demostración se usa `expiresIn` como duración.

La UI termina la sesión al alcanzar `exp`, antes y después de operaciones privadas, al recuperar foco, cambiar visibilidad o recibir `pageshow`. El temporizador maneja también duraciones superiores al máximo de setTimeout. La tolerancia backend de 60 segundos no se añade al vencimiento UI. Las pruebas aquí verifican el reloj UI; la validación criptográfica y el skew del backend requieren aceptación independiente después de G0.

Logout borra el token y usuario, aborta operaciones y cambia la generación de sesión. Los resultados de generaciones anteriores se rechazan aunque el transporte ignore AbortSignal. El guard desmonta el árbol privado (incluido su estado local); atrás/adelante no lo restaura sin sesión. No existe todavía un caché global de datos de negocio. Los módulos que se agreguen deberán usar `runAuthenticated` y publicar datos solo después de que resuelva; no escribir cachés dentro del callback. La integración del cliente HTTP común, restricción de destinos Bearer y tratamiento global de 401/403 corresponden a #4.

Logout local no revoca inmediatamente un Bearer copiado. El servidor sigue decidiendo su validez. La protección del navegador tampoco garantiza resistencia a código malicioso ejecutado en el mismo origen.

## Validación reproducible

Node 24.15.0, npm y dependencias de package-lock.json. Comandos: `npm ci --no-audit --no-fund`, `npm run build`, `npm run lint`, `npm test`.

44 pruebas: 11 de la base conservadas y 33 adicionales. Cubren parsing/vencimiento, identidad de me, cancelación y respuestas tardías, cambio de sesión, registro sin autenticación automática, rutas privadas, historial, foco, reconstrucción de la aplicación, límites UTF-8, limpieza de contraseña, errores sanitizados y bloqueo de red antes de G0. Los tests del adapter Gateway usan fetch simulado. No se ejecutaron suites backend ni se modificaron sus servicios.

También se verificó en navegador local: acceso directo privado redirige a login, login vuelve al módulo pedido, navegación conserva sesión, logout e historial no recuperan el layout privado, registro simulado y recarga que exige reingresar. El servidor local de prueba se retira al finalizar.
