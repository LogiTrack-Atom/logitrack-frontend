import { API_PREFIX } from '../config/api'
import { USE_MOCKS } from '../config/env'
import { createCourierMockRepository } from '../../modules/couriers/mocks/courierServer'
import { createShipmentMockRequest } from '../../modules/shipments/mocks/shipmentServer'
import type { HttpRequest } from './httpClient'

/** Proveedores ficticios compartidos: Shipment observa el estado vigente de Courier. */
export function createDemoGateway(delayMs = 150): HttpRequest {
  const courier = createCourierMockRepository(delayMs)
  const shipment = createShipmentMockRequest(delayMs, courier)
  return (path, options) => {
    const pathname = new URL(path, 'http://simulacion.invalid').pathname
    return pathname.startsWith(`${API_PREFIX.courier}/`) ? courier.request(path, options) : shipment(path, options)
  }
}

/** Datos de demostración en memoria de la pestaña, sin habilitación de red real. */
export const demoGateway = USE_MOCKS ? createDemoGateway() : undefined
