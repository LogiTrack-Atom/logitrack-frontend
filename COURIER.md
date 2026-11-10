# Integración Courier — S04-08

Adaptación de [frontend#6](https://github.com/LogiTrack-Atom/logitrack-frontend/issues/6) sobre la base compartida de Gab y las PR #16/#17/#18. Rama `feature/6-courier-integracion`, creada desde Development con origen `feature/5-shipment-flujo` (`814eb02`). La base temporal de su PR es esa dependencia: no fusionar en ella; integrar primero las dependencias y cambiar la base a `develop` antes de aceptar/mergear.

## Aportes conservados y alcance

La fuente es [JMatiasF, commit e6622af](https://github.com/LogiTrack-Atom/logitrack-frontend/commit/e6622af3dd2696fa86e659f0df4e1cfac2ea6a5c). Se adaptaron su contrato Courier, validación y parsing de DTO/disponibilidad, sus operaciones con GET posterior de confirmación y sus 12 pruebas de contrato/operaciones. Los archivos derivados identifican el origen. Su rama original permanece intacta; esta integración conserva los módulos, router, estilos base, dependencias y sesión compartidos.

La lista ADMIN tiene filtro por estado, carga, vacío y error. Alta/edición validan nombre y tipoVehiculo no vacíos y hasta 255 caracteres. El alta exige 201 y un GET que confirme ACTIVO; edición y cambio de estado exigen 200 y un GET coincidente. No se agrega DELETE ni un endpoint Courier /me inexistente.

REPARTIDOR consulta por UUID su ficha vinculada y disponibilidad, en solo lectura. No solicita el listado ni presenta escrituras. CLIENTE continúa bloqueado por el guard de módulo; el servicio simulado también exige roles y pertenencia por usuarioId. Usuario de seguridad y repartidor de dominio tienen IDs diferentes.

Un POST 202, respuesta inválida, falla de transporte o confirmación fallida no se muestran como éxito. La UI bloquea la repetición automática y ofrece reconciliación mediante lecturas conocidas. Si no se conoce un ID de alta, se revisa el directorio antes de decidir otro intento. No hay garantía de idempotencia de POST ni de transacción distribuida.

## Cliente y cancelación

Courier usa el cliente HTTP de #4; no incorpora Axios ni otra instancia de autenticación. La opción `includeStatus` permite a las operaciones distinguir 201/200 de 202/204 sin perder el cuerpo del DTO. Es optativa y conserva el comportamiento previo para los demás consumidores.

Los clientes privados quedan ligados a la generación en que se crearon. Al cambiar de sesión, una instancia vieja rechaza nuevos requests antes de enviarlos; esto protege también el GET posterior de un flujo de varios pasos. Los hooks renuevan el cliente por generación. Las señales de componente y sesión se combinan y las respuestas de otra identidad quedan descartadas. El módulo se desmonta al terminar la sesión.

## Simulación compartida con Shipment

`createDemoGateway` compone los servidores ficticios Courier y Shipment; la aplicación usa una instancia en memoria de la pestaña. Las pruebas crean instancias aisladas. Cambiar de módulo/perfil conserva los datos del servidor de demostración; recargar reinicia sus registros. No hay almacenamiento persistente ni llamadas reales.

Courier incluye dos fichas ficticias iniciales: `...0201` vinculada al usuario REPARTIDOR `...0003`, y `...0202` de otra identidad. Las altas generan nuevos UUID y comienzan ACTIVO. La integración #7 permite asociarlas a una cuenta mediante el flujo administrativo descrito en ADMIN.md. No se infiere propiedad por el correo ni se inventa una asociación automática.

Shipment consulta el estado actual de este registro para asignar y para comenzar EN_RUTA. Un INACTIVO o inexistente produce 422 sin mutar envío/historial. Reactivar permite continuar. Asignar sigue sin cambiar estado ni agregar un evento. La disponibilidad ACTIVO no reserva capacidad ni implica exclusividad. El comportamiento de ENTREGADO conserva las reglas existentes; no se agregó una comprobación de disponibilidad ajena al contrato.

Los mocks y el bloqueo del transporte real permanecen activos. Estas pruebas no acreditan persistencia ni pertenencia de servicios desplegados. G0, contratos #71, política docente de sesión y hosting/aceptación remota siguen pendientes. #6 no se cierra con esta preparación. Administración #7 y aceptación integral #9 continúan como entregas separadas.

## Validación

Node 24.15.0, package-lock.json y dependencias previas. `npm ci`, build, lint sin advertencias, `git diff --check` y 159 pruebas aprobados: 132 previas, 12 adaptadas de JMatiasF y 15 adicionales de UI, integración y metadatos HTTP. Se verifican confirmación GET, 202 incierto, cancelación por identidad, pertenencia, filtrado, disponibilidad, rechazo sin efectos parciales y ausencia de DELETE.

En navegador local: ADMIN crea y edita con lectura de confirmación; desactiva y observa disponibilidad falsa; Shipment rechaza asignación a INACTIVO; reactivación permite asignar sin evento extra; nueva desactivación impide EN_RUTA; reactivación y perfil REPARTIDOR permiten EN_RUTA/ENTREGADO con exactamente tres eventos. La ficha propia del repartidor se presentó en solo lectura. Se revisó la presentación del detalle final.

No se ejecutaron suites backend ni la suite Playwright original completa. Sus pruebas de navegador se conservan en la rama original como referencia para #9; las comprobaciones descritas aquí se ejecutaron sobre la base integrada. No se modificó Java ni se desplegó un hosting/cluster. No hay cambios en develop.
