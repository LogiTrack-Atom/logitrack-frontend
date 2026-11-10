import { gatewayUrl } from './gatewayUrl'
import { HttpError, RequestError } from './httpError'

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
  /** Devuelve {status,data} para contratos que deben distinguir 201/200 de 202. */
  includeStatus?: boolean
}

export type HttpRequest = <T>(path: string, options?: RequestOptions) => Promise<T>
export interface HttpClient { request: HttpRequest }

/** Transporte preparado para Gateway. Su uso real sigue bloqueado en los adapters activos. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = gatewayUrl(path)
  if (options.signal?.aborted) throw new DOMException('Solicitud cancelada.', 'AbortError')
  const hasBody = options.body !== undefined
  let response: Response
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
    })
  } catch {
    if (options.signal?.aborted) throw new DOMException('Solicitud cancelada.', 'AbortError')
    throw new RequestError('network')
  }
  if (response.redirected) throw new RequestError('destination')
  // ApiError, ProblemDetail, HTML y cuerpos vacíos de error comparten el status HTTP.
  // No consumir ni conservar un cuerpo de error que pueda reflejar información sensible.
  if (!response.ok) throw new HttpError(response.status)
  if (response.status === 204 || response.status === 205) return (options.includeStatus ? { status: response.status, data: undefined } : undefined) as T
  try {
    const data: unknown = await response.json()
    return (options.includeStatus ? { status: response.status, data } : data) as T
  } catch {
    if (options.signal?.aborted) throw new DOMException('Solicitud cancelada.', 'AbortError')
    throw new RequestError('response')
  }
}

/** Cliente activo por defecto: no habilita red con solo desactivar mocks antes de G0. */
export const integrationBlockedRequest: HttpRequest = async () => { throw new RequestError('integration') }
