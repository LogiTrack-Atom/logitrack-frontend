import type { IsoInstant, Uuid } from '../../shared/types'

/** PROVISIONAL: modelos del borrador de contratos (shipment-service#71). */

export const ESTADOS_ENVIO = ['PENDIENTE', 'EN_RUTA', 'ENTREGADO', 'CANCELADO'] as const
export type EstadoEnvio = (typeof ESTADOS_ENVIO)[number]

export interface Direccion {
  calle: string
  numero: string
  ciudad: string
  codigoPostal: string
}

export interface Cliente {
  id: Uuid
  nombre: string
  email: string
  telefono: string | null
}

export interface ClienteRequest {
  nombre: string
  email: string
  telefono?: string | null
}

export interface Envio {
  id: Uuid
  codigoSeguimiento: string
  cliente: Cliente
  repartidorId: Uuid | null
  pesoKg: number
  anchoCm: number
  altoCm: number
  largoCm: number
  estado: EstadoEnvio
  origen: Direccion
  destino: Direccion
  createdAt: IsoInstant
  updatedAt: IsoInstant
}

/** Alta de envío: no se envían id, estado, usuarioId ni repartidor. */
export interface EnvioRequest {
  cliente: ClienteRequest
  origen: Direccion
  destino: Direccion
  pesoKg: number
  anchoCm: number
  altoCm: number
  largoCm: number
}

export interface HistorialEvento {
  id: Uuid
  estadoAnterior: EstadoEnvio | null
  estadoNuevo: EstadoEnvio
  fechaCambio: IsoInstant
}

export interface AsociacionUsuario {
  recursoId: Uuid
  usuarioId: Uuid
}
