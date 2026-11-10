import { ROLES } from '../types'
import type { CredencialesLogin, RegistroRequest, Token, Usuario } from '../types'

/** Un transporte no conserva credenciales y debe propagar AbortSignal. */
export interface AuthTransport {
  mode: 'mock' | 'gateway'
  login(data: CredencialesLogin, signal: AbortSignal): Promise<Token>
  me(token: string, signal: AbortSignal): Promise<Usuario>
  register(data: RegistroRequest, signal: AbortSignal): Promise<Usuario>
}

export interface SessionSnapshot {
  status: 'anonymous' | 'authenticating' | 'authenticated'
  user: Usuario | null
  expiresAt: number | null
  epoch: number
  reason?: 'logout' | 'expired' | 'failed'
}

/** Lee exp/sub para el ciclo de vida local; no verifica firmas ni autoriza operaciones. */
export function readJwtLifetime(token: string, now = Date.now()): { expiresAt: number; subject: string } {
  try {
    const parts = token.split('.')
    if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error()
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')), (c) => c.charCodeAt(0))
    const claims: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    if (typeof claims !== 'object' || claims === null) throw new Error()
    const { exp, sub } = claims as Record<string, unknown>
    if (typeof exp !== 'number' || !Number.isSafeInteger(exp) || !Number.isSafeInteger(exp * 1000)
      || exp * 1000 <= now || typeof sub !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sub)) throw new Error()
    return { expiresAt: exp * 1000, subject: sub }
  } catch {
    throw new Error('La respuesta de autenticación no es válida o ya venció.')
  }
}

const cancelled = () => new DOMException('Operación de sesión cancelada.', 'AbortError')

/**
 * Sesión aislada en memoria. Cada cambio de identidad invalida y aborta las operaciones
 * anteriores, incluso si el transporte ignora la cancelación. No usa almacenamiento web.
 */
export class SessionStore {
  #transport: AuthTransport
  #token: string | null = null
  #snapshot: SessionSnapshot = { status: 'anonymous', user: null, expiresAt: null, epoch: 0 }
  #listeners = new Set<() => void>()
  #pending = new Set<AbortController>()
  #timer: ReturnType<typeof setTimeout> | undefined

  constructor(transport: AuthTransport) { this.#transport = transport }

  getSnapshot = (): SessionSnapshot => this.#snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    this.#schedule()
    return () => {
      this.#listeners.delete(listener)
      if (this.#listeners.size === 0) clearTimeout(this.#timer)
    }
  }

  #publish(snapshot: SessionSnapshot) {
    this.#snapshot = snapshot
    this.#schedule()
    this.#listeners.forEach((listener) => listener())
  }

  #schedule() {
    clearTimeout(this.#timer)
    const expiry = this.#snapshot.expiresAt
    if (expiry !== null && this.#listeners.size > 0) {
      this.#timer = setTimeout(() => {
        this.checkExpiry()
        this.#schedule()
      }, Math.max(0, Math.min(expiry - Date.now(), 2_147_483_647)))
    }
  }

  logout = (reason: SessionSnapshot['reason'] = 'logout'): void => {
    this.#token = null
    this.#pending.forEach((controller) => controller.abort())
    this.#pending.clear()
    this.#publish({ status: 'anonymous', user: null, expiresAt: null, epoch: this.#snapshot.epoch + 1, reason })
  }

  /** Se ejecuta también en foco, pageshow y antes/después de cada operación privada. */
  checkExpiry = (): boolean => {
    if (this.#snapshot.expiresAt !== null && Date.now() >= this.#snapshot.expiresAt) this.logout('expired')
    return this.#snapshot.status === 'authenticated'
  }

  cancelAuthentication = (): void => {
    if (this.#snapshot.status === 'authenticating') this.logout()
  }

  async login(credentials: CredencialesLogin): Promise<void> {
    this.logout()
    const epoch = this.#snapshot.epoch
    const controller = new AbortController()
    this.#pending.add(controller)
    this.#publish({ ...this.#snapshot, status: 'authenticating', reason: undefined })
    const current = () => {
      if (controller.signal.aborted || epoch !== this.#snapshot.epoch) throw cancelled()
    }
    try {
      const token = await this.#transport.login(credentials, controller.signal)
      current()
      if (token.tokenType !== 'Bearer' || !token.accessToken || !Number.isFinite(token.expiresIn) || token.expiresIn <= 0) throw new Error()
      const lifetime = this.#transport.mode === 'gateway'
        ? readJwtLifetime(token.accessToken)
        : { expiresAt: Date.now() + token.expiresIn * 1000, subject: null }
      if (!Number.isSafeInteger(lifetime.expiresAt)) throw new Error()
      const user = await this.#transport.me(token.accessToken, controller.signal)
      current()
      if (Date.now() >= lifetime.expiresAt || !user.id || !user.email || !Array.isArray(user.roles)
        || user.roles.length === 0 || user.roles.some((role) => !ROLES.includes(role))
        || (lifetime.subject !== null && lifetime.subject.toLowerCase() !== user.id.toLowerCase())) throw new Error()
      this.#token = token.accessToken
      this.#publish({ status: 'authenticated', user: structuredClone(user), expiresAt: lifetime.expiresAt, epoch })
    } catch (error) {
      current()
      this.logout('failed')
      // No mostrar cuerpos HTTP que pudieran reflejar una credencial del request.
      // eslint-disable-next-line preserve-caught-error -- No retener cuerpos HTTP ni credenciales en cause.
      throw new Error(error instanceof Error && error.message === 'Integración real pendiente de G0.'
        ? error.message : 'No se pudo iniciar sesión. Revisá tus datos e intentá nuevamente.')
    } finally { this.#pending.delete(controller) }
  }

  async register(data: RegistroRequest): Promise<void> {
    this.logout()
    const epoch = this.#snapshot.epoch
    const controller = new AbortController()
    this.#pending.add(controller)
    this.#publish({ ...this.#snapshot, status: 'authenticating', reason: undefined })
    try {
      await this.#transport.register(data, controller.signal)
      if (controller.signal.aborted || epoch !== this.#snapshot.epoch) throw cancelled()
      this.logout()
    } catch (error) {
      if (controller.signal.aborted || epoch !== this.#snapshot.epoch) throw cancelled()
      this.logout('failed')
      // eslint-disable-next-line preserve-caught-error -- No retener cuerpos HTTP ni credenciales en cause.
      throw new Error(error instanceof Error && error.message === 'Integración real pendiente de G0.'
        ? error.message : 'No se pudo completar el registro. Revisá tus datos e intentá nuevamente.')
    } finally { this.#pending.delete(controller) }
  }

  /**
   * Puerta de entrada para requests privados: verifica vencimiento, aporta cancelación
   * y descarta resultados de otra sesión. El cliente HTTP de #4 restringirá destinos Bearer.
   */
  async runAuthenticated<T>(operation: (token: string, signal: AbortSignal) => Promise<T>): Promise<T> {
    if (!this.checkExpiry() || !this.#token) throw cancelled()
    const epoch = this.#snapshot.epoch
    const controller = new AbortController()
    this.#pending.add(controller)
    try {
      const result = await operation(this.#token, controller.signal)
      if (!this.checkExpiry() || epoch !== this.#snapshot.epoch || controller.signal.aborted) throw cancelled()
      return result
    } catch (error) {
      if (!this.checkExpiry() || epoch !== this.#snapshot.epoch || controller.signal.aborted) throw cancelled()
      throw error
    } finally { this.#pending.delete(controller) }
  }
}
