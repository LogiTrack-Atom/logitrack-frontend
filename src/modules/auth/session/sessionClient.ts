import { API_PREFIX } from '../../../shared/config/api'
import { USE_MOCKS } from '../../../shared/config/env'
import { request } from '../../../shared/http/httpClient'
import { mockPersonaForEmail, mockPersonaForToken, mockToken } from '../mocks/personas'
import { tokenMock, usuarioClienteMock } from '../mocks/auth.mock'
import type { Token, Usuario } from '../types'
import type { AuthTransport } from './session'

/** Adapter provisional: solo rutas relativas conocidas del servicio de seguridad. */
export const gatewayAuthTransport: AuthTransport = {
  mode: 'gateway',
  login: (body, signal) => request<Token>(`${API_PREFIX.security}/auth/login`, { method: 'POST', body, signal }),
  me: (token, signal) => request<Usuario>(`${API_PREFIX.security}/auth/me`, { headers: { Authorization: `Bearer ${token}` }, signal }),
  register: (body, signal) => request<Usuario>(`${API_PREFIX.security}/auth/register`, { method: 'POST', body, signal }),
}

/** Demora cancelable. El token de demostración no es un JWT ni una credencial real. */
function demo<T>(data: T, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      reject(new DOMException('Operación cancelada.', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve(structuredClone(data))
    }, 250)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
  })
}

const mockTransport: AuthTransport = {
  mode: 'mock',
  login: (data, signal) => demo({ ...tokenMock, accessToken: mockToken(mockPersonaForEmail(data.email).roles[0]) }, signal),
  me: (token, signal) => {
    const user = mockPersonaForToken(token)
    return user ? demo(user, signal) : Promise.reject(new Error('Perfil simulado no válido.'))
  },
  register: (data, signal) => demo({ ...usuarioClienteMock, email: data.email }, signal),
}

const blocked = async (): Promise<never> => { throw new Error('Integración real pendiente de G0.') }

/** Fail closed: quitar mocks no habilita integración antes de aprobar G0 y contratos. */
export const activeAuthTransport: AuthTransport = USE_MOCKS ? mockTransport : {
  mode: 'gateway', login: blocked, me: blocked, register: blocked,
}
