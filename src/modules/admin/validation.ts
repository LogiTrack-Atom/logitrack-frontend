import type { UsuarioCreateRequest } from '../auth/types'
import { ROLES } from '../auth/types'

/** Solo valida datos de alta; nunca recorta ni normaliza la contraseña. */
export function validateAccount(data: UsuarioCreateRequest): UsuarioCreateRequest {
  const email = data.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Ingresá un correo válido de hasta 254 caracteres.')
  if (!ROLES.includes(data.rol)) throw new Error('Seleccioná un rol válido.')
  if (data.password.length < 12 || data.password.length > 72 || new TextEncoder().encode(data.password).length > 72) throw new Error('La contraseña requiere entre 12 y 72 caracteres y hasta 72 bytes UTF-8.')
  return { email, password: data.password, rol: data.rol }
}
