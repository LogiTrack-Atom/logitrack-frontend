# CI del frontend — shipment-service#73

El workflow verifica PR hacia develop, pushes a develop y ejecución manual. Usa
acciones oficiales fijadas por commit, permisos contents:read y Node 24.15.0.
Instala el lockfile, ejecuta lint/Vitest y compila los modos mock y real. Después
construye la imagen multietapa sin mocks y prueba salud, usuario no-root, rootfs
read-only, deep links y preservación de errores API. El puerto del ensayo es
efímero y queda ligado a loopback; el contenedor se elimina incluso ante fallos.
No recibe claves ni secretos y no publica imágenes.

El upstream deliberadamente inaccesible permite comprobar 502 sin convertirlo en
SPA; no acredita dominio, autenticación ni integración con servicios reales. Esa
aceptación corresponde a frontend#9. El release y manifiesto se coordinan en
shipment-service#73; una CI verde por sí sola no aprueba G1 ni la entrega académica.

Humo local: construir `logitrack-frontend:ci` con VITE_USE_MOCKS=false y ejecutar
`bash .github/scripts/verify-container.sh`.
