/**
 * PROVISIONAL: rutas según el borrador de contratos del frontend (shipment-service#71),
 * pendiente de aprobación e integración. Se concentran acá para cambiarlas en un solo lugar.
 * El Gateway elimina "/applications/<servicio>" antes de reenviar al servicio.
 */
export const API_PREFIX = {
  shipment: '/applications/apishipment/api/v1',
  courier: '/applications/apicourier/api/v1',
  security: '/applications/apisecurity/api/v1',
} as const
