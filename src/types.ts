export type Role = 'ADMIN' | 'CLIENTE' | 'REPARTIDOR'
export type ShipmentStatus = 'PENDIENTE' | 'EN_RUTA' | 'ENTREGADO' | 'CANCELADO'
export type CourierStatus = 'ACTIVO' | 'INACTIVO'

export interface User { id: string; email: string; roles: Role[]; createdAt?: string; updatedAt?: string }
export interface TokenResponse { accessToken: string; tokenType: string; expiresIn: number }
export interface Address { calle: string; numero: string; ciudad: string; codigoPostal: string }
export interface Customer { id: string; nombre: string; email: string; telefono?: string | null }
export interface Shipment {
  id: string; codigoSeguimiento: string; cliente: Customer; repartidorId: string | null;
  pesoKg: number; anchoCm: number; altoCm: number; largoCm: number;
  estado: ShipmentStatus; origen: Address; destino: Address;
  createdAt: string; updatedAt: string
}
export interface ShipmentCreate {
  cliente: Omit<Customer,'id'>; origen: Address; destino: Address;
  pesoKg: number; anchoCm: number; altoCm: number; largoCm: number
}
export interface ShipmentEvent { id: string; estadoAnterior: ShipmentStatus | null; estadoNuevo: ShipmentStatus; fechaCambio: string }
export interface Courier { id: string; nombre: string; tipoVehiculo: string; estado: CourierStatus; createdAt: string; updatedAt: string }
export interface Availability { repartidorId: string; estado: CourierStatus; disponible: boolean }
export interface Association { usuarioId: string; [other: string]: unknown }
