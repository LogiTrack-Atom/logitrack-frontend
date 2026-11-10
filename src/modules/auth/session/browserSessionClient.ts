import { API_PREFIX } from '../../../shared/config/api'
import { gatewayUrl } from '../../../shared/http/gatewayUrl'
import { HttpError, RequestError } from '../../../shared/http/httpError'
import type { CredencialesLogin, Token } from '../types'

/** Marcador sin credenciales: impide restaurar una sesión cuyo logout no se confirmó. */
export const LOGOUT_PENDING = 'logitrack.session.logout-pending'
let pending = Promise.resolve<unknown>(undefined)

let storageUnavailable = false
function markLogoutPending() {
  try { window.localStorage.setItem(LOGOUT_PENDING, '1') } catch { storageUnavailable = true }
}
function clearLogoutPending() {
  try { window.localStorage.removeItem(LOGOUT_PENDING) } catch { storageUnavailable = true }
}
function mustCompleteLogout(): boolean {
  if (storageUnavailable) return true
  try { return window.localStorage.getItem(LOGOUT_PENDING) !== null } catch { return true }
}

/** Serializa escrituras de cookie por pestaña y, con Web Locks, entre pestañas del origen. */
function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const action = () => navigator.locks ? navigator.locks.request('logitrack-browser-session', operation) : operation()
  const result = pending.catch(() => undefined).then(action)
  pending = result.catch(() => undefined)
  return result
}

/** Solo estos tres endpoints pueden enviar cookies; negocio y me conservan Bearer sin cookies. */
async function exchange(suffix: '' | '/refresh' | '/logout', body?: CredencialesLogin): Promise<Token | undefined> {
  const path = `${API_PREFIX.security}/auth/session${suffix}`
  const target = gatewayUrl(path)
  const url = new URL(target, window.location.origin)
  if (url.origin !== window.location.origin || (url.protocol !== 'https:' && url.hostname !== 'localhost')) {
    throw new RequestError('destination')
  }
  let response: Response
  try {
    // Una cancelación de UI no libera antes la exclusión de una escritura de cookie.
    // El resultado se descarta por generación; logout queda detrás del intercambio en curso.
    response = await fetch(target, {
      method: 'POST', credentials: 'same-origin', redirect: 'error', cache: 'no-store',
      headers: { Accept: 'application/json', 'X-LogiTrack-Session': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15_000),
    })
  } catch { throw new RequestError('network') }
  if (response.redirected) throw new RequestError('destination')
  if (!response.ok) throw new HttpError(response.status)
  if (suffix === '/logout') {
    if (response.status !== 204) throw new RequestError('response')
    return undefined
  }
  try { return await response.json() as Token } catch { throw new RequestError('response') }
}

/** Login explícito sustituye la cookie previa y evita restaurarla si el resultado queda incierto. */
export function browserLogin(data: CredencialesLogin, signal: AbortSignal): Promise<Token> {
  markLogoutPending()
  return serialized(async () => {
    if (signal.aborted) throw new DOMException('Operación cancelada.', 'AbortError')
    const token = await exchange('', data)
    if (signal.aborted) throw new DOMException('Operación cancelada.', 'AbortError')
    clearLogoutPending()
    return token as Token
  })
}

/** Recupera acceso en memoria sin leer la cookie HttpOnly ni reintentar operaciones de negocio. */
export function browserRestore(signal: AbortSignal): Promise<Token> {
  return serialized(async () => {
    if (signal.aborted) throw new DOMException('Operación cancelada.', 'AbortError')
    if (mustCompleteLogout()) {
      await exchange('/logout')
      clearLogoutPending()
      throw new HttpError(401)
    }
    const token = await exchange('/refresh')
    if (signal.aborted) throw new DOMException('Operación cancelada.', 'AbortError')
    return token as Token
  })
}

/** Registra intención antes de la red; una falla conserva el bloqueo de restauración. */
export async function browserLogout(): Promise<void> {
  markLogoutPending()
  return serialized(async () => {
    await exchange('/logout')
    clearLogoutPending()
  })
}
