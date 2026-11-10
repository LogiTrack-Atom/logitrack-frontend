import { HttpError } from '../../../shared/http/httpError'
import { validateAccount } from '../../admin/validation'
import { usuarioClienteMock } from './auth.mock'
import type { Rol, Usuario, UsuarioCreateRequest } from '../types'

const initial: Usuario[] = [
  usuarioClienteMock,
  { ...usuarioClienteMock, id: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com', roles: ['ADMIN'] },
  { ...usuarioClienteMock, id: '00000000-0000-4000-8000-000000000003', email: 'repartidor@example.com', roles: ['REPARTIDOR'] },
  { ...usuarioClienteMock, id: '00000000-0000-4000-8000-000000000004', email: 'otro.repartidor@example.com', roles: ['REPARTIDOR'] },
  { ...usuarioClienteMock, id: '00000000-0000-4000-8000-000000000005', email: 'otro.cliente@example.com', roles: ['CLIENTE'] },
]

/** Etiqueta ficticia sin firma JWT ni valor de credencial real. */
export const mockUserToken = (user: Usuario): string => `demostracion-usuario-${user.id}-no-valida`

/** Directorio de demostración: conserva únicamente metadatos, nunca contraseñas. */
export function createMockIdentityDirectory() {
  const users = new Map(initial.map((user) => [user.id, structuredClone(user)]))
  const find = (id: string): Usuario | null => structuredClone(users.get(id) ?? null)
  const byEmail = (email: string): Usuario | null => structuredClone([...users.values()].find((user) => user.email === email) ?? null)
  const resolveToken = (token: string): Usuario | null => {
    const role = (['ADMIN', 'CLIENTE', 'REPARTIDOR'] as Rol[]).find((role) => token === `demostracion-${role.toLowerCase()}-no-valida`)
    if (role) return structuredClone(initial.find((user) => user.roles.includes(role))!)
    const match = /^demostracion-usuario-([0-9a-f-]{36})-no-valida$/i.exec(token)
    return match ? find(match[1]) : null
  }
  const create = (body: UsuarioCreateRequest): Usuario => {
    let data
    try { data = validateAccount(body) } catch { throw new HttpError(400) }
    if (byEmail(data.email)) throw new HttpError(409)
    const date = new Date().toISOString()
    const user: Usuario = { id: crypto.randomUUID(), email: data.email, roles: [data.rol], createdAt: date, updatedAt: date }
    users.set(user.id, user)
    return structuredClone(user)
  }
  return { find, byEmail, resolveToken, create }
}
export type MockIdentityDirectory = ReturnType<typeof createMockIdentityDirectory>
export const demoIdentities = createMockIdentityDirectory()
