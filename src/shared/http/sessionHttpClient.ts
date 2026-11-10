import type { SessionStore } from '../../modules/auth/session/session'
import { gatewayUrl } from './gatewayUrl'
import { HttpError, RequestError } from './httpError'
import { integrationBlockedRequest } from './httpClient'
import type { HttpClient, HttpRequest, RequestOptions } from './httpClient'

/**
 * Vincula requests privados a una generación de sesión y restringe la propagación Bearer.
 * Un 401/403 vigente limpia una sola vez. Respuestas de otra sesión quedan canceladas.
 * El transporte predeterminado permanece bloqueado hasta G0; las pruebas inyectan un fake.
 */
export function createSessionHttpClient(session: SessionStore, send: HttpRequest = integrationBlockedRequest, clientEpoch = session.getSnapshot().epoch): HttpClient {
  return {
    request: async <T>(path: string, options: RequestOptions = {}) => {
      if (session.getSnapshot().epoch !== clientEpoch) throw new DOMException('Cliente de otra sesión.', 'AbortError')
      gatewayUrl(path)
      if (Object.keys(options.headers ?? {}).some((key) => key.toLowerCase() === 'authorization')) {
        return Promise.reject(new RequestError('destination'))
      }
      return session.runAuthenticated<T>(async (token, sessionSignal) => {
        const epoch = session.getSnapshot().epoch
        const signal = options.signal ? AbortSignal.any([sessionSignal, options.signal]) : sessionSignal
        if (signal.aborted) throw new DOMException('Solicitud cancelada.', 'AbortError')
        try {
          const result = await send<T>(path, { ...options, signal, headers: { ...options.headers, Authorization: `Bearer ${token}` } })
          if (signal.aborted) throw new DOMException('Solicitud cancelada.', 'AbortError')
          return result
        } catch (error) {
          if (signal.aborted) throw new DOMException('Solicitud cancelada.', 'AbortError')
          if (error instanceof HttpError && (error.status === 401 || error.status === 403)
            && session.getSnapshot().epoch === epoch && session.getSnapshot().status === 'authenticated') {
            session.logout('unauthorized')
          }
          throw error
        }
      })
    },
  }
}
