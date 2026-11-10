import { API_PREFIX } from '../config/api'
import { USE_MOCKS } from '../config/env'
import { createCourierMockRepository } from '../../modules/couriers/mocks/courierServer'
import { createShipmentMockRequest } from '../../modules/shipments/mocks/shipmentServer'
import { createMockIdentityDirectory, demoIdentities } from '../../modules/auth/mocks/identityDirectory'
import { createSecurityMockRequest } from '../../modules/auth/mocks/securityServer'
import type { HttpRequest } from './httpClient'

/** Proveedores ficticios compartidos: Shipment observa el estado vigente de Courier. */
export function createDemoGateway(delayMs = 150, identities = createMockIdentityDirectory()): HttpRequest {
  const courier = createCourierMockRepository(delayMs, identities)
  const shipment = createShipmentMockRequest(delayMs, courier, identities)
  const security = createSecurityMockRequest(identities, delayMs)
  return (path, options) => {
    const pathname = new URL(path, 'http://simulacion.invalid').pathname
    if (pathname.startsWith(`${API_PREFIX.security}/`)) return security(path, options)
    return pathname.startsWith(`${API_PREFIX.courier}/`) ? courier.request(path, options) : shipment(path, options)
  }
}

/** Datos de demostración en memoria de la pestaña, sin habilitación de red real. */
export const demoGateway = USE_MOCKS ? createDemoGateway(150, demoIdentities) : undefined
