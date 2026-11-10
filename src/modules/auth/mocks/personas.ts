import type { Rol, Usuario } from '../types'
import { usuarioClienteMock } from './auth.mock'

const personas: Record<Rol, Usuario> = {
  CLIENTE: usuarioClienteMock,
  ADMIN: { ...usuarioClienteMock, id: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com', roles: ['ADMIN'] },
  REPARTIDOR: { ...usuarioClienteMock, id: '00000000-0000-4000-8000-000000000003', email: 'repartidor@example.com', roles: ['REPARTIDOR'] },
}

/** Solo demostración: etiquetas opacas, sin firma JWT ni valor de credencial real. */
export const mockToken = (role: Rol): string => `demostracion-${role.toLowerCase()}-no-valida`

export function mockPersonaForEmail(email: string): Usuario {
  return structuredClone(Object.values(personas).find((user) => user.email === email) ?? personas.CLIENTE)
}

export function mockPersonaForToken(token: string): Usuario | null {
  const role = (Object.keys(personas) as Rol[]).find((role) => mockToken(role) === token)
  return role ? structuredClone(personas[role]) : null
}
