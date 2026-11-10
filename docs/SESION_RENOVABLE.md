# Sesión renovable — frontend#3 / security-service#11

Decisión del equipo del 10/11/2026: la sesión real se recupera al recargar. El JWT
continúa solo en memoria; Security emite una cookie de renovación HttpOnly/Secure/
SameSite=Strict que React no puede leer. Mock conserva su comportamiento de reinicio.

Requiere Security y Gateway con las PR de security-service#11, la migración
002-refresh-sessions.sql y `SESSION_ORIGIN` igual al origen público exacto del
frontend. Usar el proxy del mismo origen: `VITE_API_BASE_URL` vacío. Los endpoints
de cookie no admiten una API cross-origin; las APIs Bearer mantienen su contrato.
En despliegue usar HTTPS. La prueba local usó http://localhost:28080, cuya excepción
Secure funciona en Chromium; otros navegadores pueden requerir HTTPS local.

Login usa `/auth/session`; el arranque usa `/auth/session/refresh` una sola vez,
incluso con React StrictMode. Me confirma la identidad antes de habilitar el árbol
privado. Los requests privados siguen con Bearer y credentials omit. Solo los tres
endpoints de sesión usan credentials same-origin y la cabecera X-LogiTrack-Session.
El navegador genera Origin; React no intenta falsificarla.

Las escrituras de cookie se serializan. Web Locks coordina pestañas compatibles;
una cancelación de UI descarta su resultado pero no adelanta el logout a un intercambio
que aún puede modificar cookies. Hay un timeout de red acotado. La reutilización real
del mismo refresh falla cerrada y revoca la familia en el servidor.

Logout borra inmediatamente el estado local y solicita la revocación. El único valor
persistido por React es el marcador no secreto `logitrack.session.logout-pending=1`;
no contiene JWT, refresh, contraseña, usuario ni IDs. Bloquea restaurar hasta completar
un logout pendiente y notifica a otras pestañas mediante storage. Si Web Storage está
inhabilitado, la restauración falla cerrada y todavía se intenta cerrar en el servidor.
Si no se confirma la red, se muestra un aviso: no se afirma logout remoto exitoso.

401/403 de negocio y exp siguen cerrando sesión; no se renueva ni reintenta esa
operación. Recargar puede renovar mientras la familia sea válida. No se promete
revocación instantánea de un Bearer copiado. Exp de UI no incorpora skew del backend.

Validación: 196 pruebas Vitest, lint y build; pruebas específicas de restauración
única, respuesta tardía, logout fallido, marcador sin secretos, orden login/logout y
cierre de otra pestaña. Navegador real por Nginx: login, recarga autenticada, logout
y recarga anónima. API real de renovación: 11 solicitudes / 17 aserciones. La regresión
existente de negocio mantiene 8 escenarios / 38 solicitudes / 57 aserciones.

Este documento reemplaza la política anterior de volver siempre al login al recargar.
Es una decisión técnica del equipo que satisface la interpretación más exigente de
persistencia de la consigna; no se atribuye una aprobación individual del profesor.
