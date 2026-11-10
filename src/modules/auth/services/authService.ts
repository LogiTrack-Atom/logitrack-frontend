import { API_PREFIX } from '../../../shared/config/api'
import { integrationBlockedRequest as request } from '../../../shared/http/httpClient'
import { withMock } from '../../../shared/http/mock'
import type { Uuid } from '../../../shared/types'
import { tokenMock, usuarioClienteMock } from '../mocks/auth.mock'
import type {
  CredencialesLogin,
  RegistroRequest,
  Token,
  Usuario,
  UsuarioCreateRequest,
} from '../types'

/**
 * PROVISIONAL: rutas y modelos del borrador de contratos (shipment-service#71).
 * Fachada de mocks heredada. Las pantallas privadas usarán useHttpClient (#4);
 * el login activo usa AuthProvider (#3). La red permanece bloqueada antes de G0. Nunca registrar credenciales ni tokens en logs.
 */
const BASE = API_PREFIX.security

export function iniciarSesion(credenciales: CredencialesLogin): Promise<Token> {
  return withMock(tokenMock, () =>
    request<Token>(`${BASE}/auth/login`, { method: 'POST', body: credenciales }),
  )
}

export function registrarse(datos: RegistroRequest): Promise<Usuario> {
  return withMock({ ...usuarioClienteMock, email: datos.email }, () =>
    request<Usuario>(`${BASE}/auth/register`, { method: 'POST', body: datos }),
  )
}

export function obtenerUsuarioActual(): Promise<Usuario> {
  return withMock(usuarioClienteMock, () => request<Usuario>(`${BASE}/auth/me`))
}

/** Solo ADMIN. */
export function crearUsuario(datos: UsuarioCreateRequest): Promise<Usuario> {
  const { rol, email } = datos
  return withMock({ ...usuarioClienteMock, email, roles: [rol] }, () =>
    request<Usuario>(`${BASE}/usuarios`, { method: 'POST', body: datos }),
  )
}

/** Solo ADMIN. */
export function obtenerUsuario(id: Uuid): Promise<Usuario> {
  return withMock(usuarioClienteMock, () =>
    request<Usuario>(`${BASE}/usuarios/${encodeURIComponent(id)}`),
  )
}
