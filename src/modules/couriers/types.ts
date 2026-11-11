import type { IsoInstant, Uuid } from '../../shared/types'

/** PROVISIONAL: modelos del borrador de contratos (shipment-service#71). */

export const ESTADOS_REPARTIDOR = ['ACTIVO', 'INACTIVO'] as const
export type EstadoRepartidor = (typeof ESTADOS_REPARTIDOR)[number]

export interface Repartidor {
  id: Uuid
  nombre: string
  tipoVehiculo: string
  estado: EstadoRepartidor
  createdAt: IsoInstant
  updatedAt: IsoInstant
}

/** Alta y edición: nombre y tipo de vehículo no vacíos, máximo 255 caracteres cada uno. */
export interface RepartidorRequest {
  nombre: string
  tipoVehiculo: string
}

/** "disponible" significa solamente estado ACTIVO: no reserva capacidad. */
export interface Disponibilidad {
  repartidorId: Uuid
  estado: EstadoRepartidor
  disponible: boolean
}

export interface IdentidadRepartidor {
  repartidorId: Uuid
  usuarioId: Uuid | null
}
