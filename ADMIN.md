# Administración e identidades — S04-09

> Estado actualizado en #9: el modo real se habilita con `VITE_USE_MOCKS=false` y se verificó por Gateway. S04-00/G0 está retirado como requisito. Ver [resultados y pendientes vigentes](docs/INTEGRACION.md). Las cantidades de pruebas y ramas descritas abajo corresponden a la entrega original de cada módulo.

Adaptación de [frontend#7](https://github.com/LogiTrack-Atom/logitrack-frontend/issues/7) a la base compartida, a partir del flujo por pasos de JMatiasF en [e6622af, Admin.tsx](https://github.com/LogiTrack-Atom/logitrack-frontend/blob/e6622af3dd2696fa86e659f0df4e1cfac2ea6a5c/src/pages/Admin.tsx). Se conserva su separación cuenta → ficha → vínculo Courier → referencia Shipment y asociación opcional de cliente. La coordinación y recuperación se implementan como estado de sesión comprobable por pruebas. Su rama original queda intacta.

Rama `feature/7-admin-integracion`, creada desde Development con base `feature/6-courier-integracion` (`19a6906`). La PR se apila sobre #19 y sus dependencias. No fusionar en esa base temporal: integrar primero las dependencias, cambiar la base a `develop` y completar aceptación antes de merge. No se modifica develop ni se cierra #7 con esta simulación.

## Flujo y recuperación

La ruta `/admin` y el menú son exclusivos ADMIN; también se comprueban permisos en el coordinador y servidores simulados. El flujo conserva en memoria IDs, correo/rol esperado, confirmaciones y resultado; las contraseñas solo transitan del formulario a la llamada de alta y el campo se vacía al enviar. No hay contraseña/JWT en el snapshot, Web Storage, URL o logs del flujo. Navegar conserva IDs; logout, vencimiento o cambio de identidad los limpia y aborta pendientes. Una respuesta tardía no vuelve a guardar IDs ni inicia confirmaciones con otra sesión.

1. Cuenta: POST debe responder 201 con UUID, seguido de GET por ese UUID que coincida en correo y rol. Si llega un ID pero falla la lectura, el ID se conserva como recibido, aún sin confirmar. Un POST con respuesta perdida y sin ID no se repite: se requiere recuperar un ID confirmado mediante verificación externa autorizada.
2. Courier: mismo criterio 201 + GET de confirmación; nombre/vehículo/ACTIVO deben coincidir. Los éxitos anteriores se conservan si falla este paso.
3. Vínculo Courier: revalida cuenta y ficha, consulta GET de identidad y solo realiza PUT si el vínculo no está confirmado. Tras PUT 200 exige otra lectura coincidente. Si la respuesta del PUT se pierde, GET permite reconciliar sin repetirlo. Otro propietario no se sobrescribe.
4. Shipment: revalida la cuenta, ficha y vínculo Courier; solo confirma PUT 200 con ambos IDs coincidentes. No existe GET de esta asociación y una lectura de Courier no la acredita. Tras respuesta perdida queda incierta; una acción explícita puede repetir el mismo PUT con IDs bloqueados y revalidados.


La asociación opcional usa un cliente local existente y una cuenta CLIENTE confirmada. Shipment decide existencia, unicidad y conflicto. No hay GET de cliente/asociación inventado: tras respuesta perdida se mantienen los mismos IDs y se ofrece repetir explícitamente el PUT idempotente después de revalidar la cuenta. El UUID de cliente se muestra al ADMIN en el detalle del envío para el flujo autorizado. Un resultado conocido 400/409/422 no se interpreta como éxito.

Recuperar después de logout exige volver a leer cuenta/ficha y el vínculo consultable. No se permite sustituir un ID ya conocido sin limpiar explícitamente el flujo. La referencia Shipment no se marca confirmada por inferencia, aunque exista de la sesión anterior; debe obtenerse confirmación de su PUT. Limpiar progreso pide confirmación y no elimina recursos de los servicios. El diagnóstico técnico continúa por API, sin pantalla dedicada.

## Simulación y límites

El directorio ficticio de Security conserva metadatos de cuentas, nunca contraseñas. Las cuentas creadas pueden usarse en la demostración con contraseña ficticia no verificada; los tokens son etiquetas opacas, sin valor JWT real. La simulación comparte IDs entre Security, Courier y Shipment, separando usuarioId/repartidorId/clienteId. Courier registra vínculos inmutables; Shipment mantiene su referencia local separada: vincular solo Courier no basta para que una cuenta nueva opere sus asignaciones.


## Validación

Node 24.15.0; npm ci, build, lint sin advertencias y git diff --check aprobados. 187 pruebas: 159 previas y 28 adicionales. La matriz induce fallos conocidos y respuestas perdidas en cada alta/vínculo, pérdida de lectura con ID recibido, reconciliación sin repetir éxitos, estados inciertos, rol/correo incompatible, limpieza de credenciales, logout/respuestas tardías, permisos y conservación del progreso al navegar. El test harness registra solo método/ruta/IDs ficticios, sin credenciales en sus trazas.

En navegador local se completó la nueva cuenta REPARTIDOR → ficha → vínculo Courier → referencia Shipment. Navegar conservó el progreso; logout lo limpió. Recuperar IDs confirmó lecturas Courier y dejó Shipment pendiente hasta confirmación explícita del PUT. Luego se asignó un envío a esa ficha y, entrando con la nueva cuenta ficticia, se completó EN_RUTA/ENTREGADO con tres eventos. Esto acredita simulación sobre la base integrada, no aceptación real de microservicios ni la suite #9. No se ejecutaron suites backend.
