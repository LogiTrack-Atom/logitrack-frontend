import type { IsoInstant, Uuid } from '../../shared/types'

/** PROVISIONAL: modelos del borrador de contratos (shipment-service#71). */

export const ROLES = ['ADMIN', 'CLIENTE', 'REPARTIDOR'] as const
export type Rol = (typeof ROLES)[number]

export interface CredencialesLogin {
  email: string
  /** Sin recortar ni normalizar. Máximo 72 caracteres y 72 bytes UTF-8. */
  password: string
}

/** El registro público solo crea usuarios CLIENTE. Password de al menos 12 caracteres. */
export interface RegistroRequest {
  email: string
  password: string
}

/** Alta administrativa: el rol es obligatorio. */
export interface UsuarioCreateRequest extends RegistroRequest {
  rol: Rol
}

export interface Usuario {
  id: Uuid
  email: string
  /** Colección, no el campo singular "rol" del alta. */
  roles: Rol[]
  createdAt: IsoInstant
  updatedAt: IsoInstant
}

/** expiresIn es una duración en segundos, no una fecha. */
export interface Token {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
}
