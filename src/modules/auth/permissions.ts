import type { Rol, Usuario } from './types'

/** Matriz provisional de presentación. La pertenencia y autorización final son del servidor. */
export const UI_ROLES = {
  all: ['ADMIN', 'CLIENTE', 'REPARTIDOR'],
  couriers: ['ADMIN', 'REPARTIDOR'],
  createShipment: ['ADMIN', 'CLIENTE'],
  advanceShipment: ['ADMIN', 'REPARTIDOR'],
  administration: ['ADMIN'],
} as const satisfies Record<string, readonly Rol[]>

export function hasAnyRole(user: Usuario | null, allowed: readonly Rol[]): boolean {
  return user !== null && user.roles.some((role) => allowed.includes(role))
}
