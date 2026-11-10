import type { Rol, Usuario } from '../types'
import { demoIdentities } from './identityDirectory'
import { usuarioClienteMock } from './auth.mock'

/** Alias de perfiles ficticios conservado para los escenarios de la base. */
export const mockToken = (role: Rol): string => `demostracion-${role.toLowerCase()}-no-valida`
export function mockPersonaForEmail(email: string): Usuario { return demoIdentities.byEmail(email) ?? structuredClone(usuarioClienteMock) }
export function mockPersonaForToken(token: string): Usuario | null { return demoIdentities.resolveToken(token) }
