import { API_PREFIX } from '../../../shared/config/api'
import { HttpError } from '../../../shared/http/httpError'
import type { HttpRequest, RequestOptions } from '../../../shared/http/httpClient'
import type { UsuarioCreateRequest } from '../types'
import type { MockIdentityDirectory } from './identityDirectory'

/** Endpoints administrativos reales del contrato, simulados sin conservar credenciales. */
export function createSecurityMockRequest(directory: MockIdentityDirectory, delayMs: number): HttpRequest {
  return <T>(path: string, options: RequestOptions = {}): Promise<T> => new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); reject(new DOMException('Solicitud cancelada.', 'AbortError')) }
    const timer = setTimeout(() => {
      options.signal?.removeEventListener('abort', abort)
      try {
        const actor = directory.resolveToken(options.headers?.Authorization?.replace(/^Bearer /, '') ?? '')
        if (!actor) throw new HttpError(401)
        if (!actor.roles.includes('ADMIN')) throw new HttpError(403)
        const url = new URL(path, 'http://simulacion.invalid')
        const base = `${API_PREFIX.security}/usuarios`
        let data, status = 200
        if (url.pathname === base && options.method === 'POST') {
          const body = options.body as UsuarioCreateRequest
          if (!body || Object.keys(body).some((key) => !['email', 'password', 'rol'].includes(key))) throw new HttpError(400)
          data = directory.create(body); status = 201
        } else if (url.pathname.startsWith(`${base}/`) && (options.method ?? 'GET') === 'GET') {
          const id = url.pathname.slice(base.length + 1)
          data = directory.find(id)
          if (!data) throw new HttpError(404)
        } else throw new HttpError(404) // No se inventa un listado de usuarios ni búsqueda por email.
        resolve(structuredClone(options.includeStatus ? { status, data } : data) as T)
      } catch (error) { reject(error) }
    }, delayMs)
    options.signal?.addEventListener('abort', abort, { once: true })
    if (options.signal?.aborted) abort()
  })
}
