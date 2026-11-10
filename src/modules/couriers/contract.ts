/** Adaptado de JMatiasF, e6622af: contrato Courier, conservando la base compartida. */
/**
 * Contratos observados en courier-service@develop, sin inventar DELETE ni rutas /me.
 * Los UUID de usuario Security y de dominio Courier son identificadores distintos.
 */
import type { Disponibilidad as Availability, Repartidor as Courier, EstadoRepartidor as CourierStatus } from './types'
import type { Rol as Role } from '../auth/types'
import { RequestError } from '../../shared/http/httpError'
export const uuidValid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

export type CourierDraft = { nombre: string; tipoVehiculo: string }

export class CourierContractError extends RequestError {
  constructor() {
    super('response')
    this.name = 'CourierContractError'
  }
}

export function isCourierStatus(value: unknown): value is CourierStatus {
  return value === 'ACTIVO' || value === 'INACTIVO'
}

export function normalizeCourierDraft(raw: CourierDraft): CourierDraft {
  const nombre = raw.nombre.trim()
  const tipoVehiculo = raw.tipoVehiculo.trim()
  if (!nombre || !tipoVehiculo || nombre.length > 255 || tipoVehiculo.length > 255) {
    throw new Error('El nombre y el vehículo son obligatorios (máximo 255 caracteres cada uno).')
  }
  return { nombre, tipoVehiculo }
}

export function parseCourier(raw: unknown): Courier {
  if (!raw || typeof raw !== 'object') throw new CourierContractError()
  const obj = raw as Record<string, unknown>
  if (
    typeof obj.id !== 'string' || !uuidValid(obj.id) ||
    typeof obj.nombre !== 'string' || !obj.nombre.trim() ||
    typeof obj.tipoVehiculo !== 'string' || !obj.tipoVehiculo.trim() ||
    !isCourierStatus(obj.estado) ||
    typeof obj.createdAt !== 'string' || !Number.isFinite(Date.parse(obj.createdAt)) ||
    typeof obj.updatedAt !== 'string' || !Number.isFinite(Date.parse(obj.updatedAt))
  ) throw new CourierContractError()
  return {
    id: obj.id, nombre: obj.nombre, tipoVehiculo: obj.tipoVehiculo,
    estado: obj.estado, createdAt: obj.createdAt, updatedAt: obj.updatedAt,
  }
}

export function parseCourierList(raw: unknown): Courier[] {
  if (!Array.isArray(raw)) throw new CourierContractError()
  return raw.map(parseCourier)
}

export function parseAvailability(raw: unknown, requestedId: string): Availability {
  if (!raw || typeof raw !== 'object') throw new CourierContractError()
  const obj = raw as Record<string, unknown>
  if (
    typeof obj.repartidorId !== 'string' || obj.repartidorId.toLowerCase() !== requestedId.toLowerCase() ||
    !isCourierStatus(obj.estado) || typeof obj.disponible !== 'boolean' ||
    obj.disponible !== (obj.estado === 'ACTIVO')
  ) throw new CourierContractError()
  return { repartidorId: obj.repartidorId, estado: obj.estado, disponible: obj.disponible }
}

export function canSeeCourierModule(roles: readonly Role[]): boolean {
  return roles.includes('ADMIN') || roles.includes('REPARTIDOR')
}
export function canListOrMutateCouriers(roles: readonly Role[]): boolean {
  return roles.includes('ADMIN')
}
