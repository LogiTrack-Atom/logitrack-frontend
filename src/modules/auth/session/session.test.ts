import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usuarioClienteMock } from '../mocks/auth.mock'
import type { Token, Usuario } from '../types'
import { readJwtLifetime, SessionStore } from './session'
import type { AuthTransport } from './session'

const NOW = 1_800_000_000_000
const user = usuarioClienteMock
const jwt = (claims: unknown) => `${btoa('{}').replace(/=/g, '')}.${btoa(JSON.stringify(claims)).replace(/=/g, '')}.signature`
const token = (exp = NOW / 1000 + 60): Token => ({ accessToken: jwt({ sub: user.id, exp }), tokenType: 'Bearer', expiresIn: 60 })
const transport = (overrides: Partial<AuthTransport> = {}): AuthTransport => ({
  mode: 'gateway', login: async () => token(), me: async () => structuredClone(user),
  register: async () => structuredClone(user), ...overrides,
})
const credentials = { email: 'cliente@example.com', password: 'demostracion' }
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW) })
afterEach(() => { vi.useRealTimers() })

describe('ciclo de vida de sesión', () => {
  it.each([null, {}, { exp: '1800000060', sub: user.id }, { exp: NOW / 1000, sub: user.id }, { exp: NOW / 1000 + 60 }, { exp: Infinity, sub: user.id }])('rechaza claims inválidos o vencidos: %j', (claims) => {
    expect(() => readJwtLifetime(jwt(claims))).toThrow('no es válida')
  })

  it.each(['token-mock-no-valido', 'a.b.c.d', 'a.%%.c'])('rechaza formato inválido: %s', (value) => {
    expect(() => readJwtLifetime(value)).toThrow('no es válida')
  })

  it('vence exactamente en exp sin sumar los 60 s de tolerancia del servidor', async () => {
    const session = new SessionStore(transport())
    const unsubscribe = session.subscribe(() => {})
    await session.login(credentials)
    expect(session.getSnapshot().expiresAt).toBe(NOW + 60_000)
    await vi.advanceTimersByTimeAsync(59_999)
    expect(session.checkExpiry()).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(session.getSnapshot()).toMatchObject({ status: 'anonymous', user: null, reason: 'expired' })
    unsubscribe()
  })

  it('comprueba vencimiento antes de enviar aun sin timer activo', async () => {
    const session = new SessionStore(transport())
    await session.login(credentials)
    vi.setSystemTime(NOW + 60_000)
    const operation = vi.fn()
    await expect(session.runAuthenticated(operation)).rejects.toMatchObject({ name: 'AbortError' })
    expect(operation).not.toHaveBeenCalled()
  })

  it('rechaza el usuario de auth/me si su id no coincide con sub', async () => {
    const session = new SessionStore(transport({ me: async () => ({ ...user, id: 'otro-usuario' }) }))
    await expect(session.login(credentials)).rejects.toThrow('No se pudo iniciar sesión')
    expect(session.getSnapshot().user).toBeNull()
  })

  it('descarta un login tardío después del logout aunque ignore AbortSignal', async () => {
    const late = deferred<Token>()
    const login = vi.fn<AuthTransport['login']>(() => late.promise)
    const me = vi.fn(async () => user)
    const session = new SessionStore(transport({ login, me }))
    const result = session.login(credentials)
    const rejection = expect(result).rejects.toMatchObject({ name: 'AbortError' })
    session.logout()
    expect(login.mock.calls[0][1].aborted).toBe(true)
    late.resolve(token())
    await rejection
    expect(me).not.toHaveBeenCalled()
    expect(session.getSnapshot().status).toBe('anonymous')
  })

  it('una respuesta vieja de me no sobrescribe otra sesión', async () => {
    const late = deferred<Usuario>()
    let calls = 0
    const session = new SessionStore(transport({ me: () => ++calls === 1 ? late.promise : Promise.resolve(user) }))
    const first = session.login(credentials)
    const rejection = expect(first).rejects.toMatchObject({ name: 'AbortError' })
    await Promise.resolve()
    await session.login(credentials)
    const epoch = session.getSnapshot().epoch
    late.resolve({ ...user, email: 'sesion-vieja@example.com' })
    await rejection
    expect(session.getSnapshot().user?.email).toBe(user.email)
    expect(session.getSnapshot().epoch).toBe(epoch)
  })

  it('aborta requests privados y descarta sus resultados al cambiar de identidad', async () => {
    const session = new SessionStore(transport())
    await session.login(credentials)
    const late = deferred<string>()
    let signal!: AbortSignal
    const response = session.runAuthenticated(async (_token, currentSignal) => {
      signal = currentSignal
      return late.promise
    })
    const rejection = expect(response).rejects.toMatchObject({ name: 'AbortError' })
    await session.login(credentials)
    expect(signal.aborted).toBe(true)
    late.resolve('dato de otra sesión')
    await rejection
  })

  it('descarta datos si el request termina después de exp', async () => {
    const session = new SessionStore(transport())
    await session.login(credentials)
    const late = deferred<string>()
    const response = session.runAuthenticated(() => late.promise)
    const rejection = expect(response).rejects.toMatchObject({ name: 'AbortError' })
    vi.setSystemTime(NOW + 60_000)
    late.resolve('dato vencido')
    await rejection
    expect(session.getSnapshot().reason).toBe('expired')
  })

  it('el registro no autentica ni conserva la contraseña en el snapshot', async () => {
    const session = new SessionStore(transport())
    await session.register(credentials)
    expect(session.getSnapshot()).toMatchObject({ status: 'anonymous', user: null })
    expect(JSON.stringify(session.getSnapshot())).not.toContain(credentials.password)
  })

  it('un nuevo store no restaura la sesión de otro store', async () => {
    const first = new SessionStore(transport())
    await first.login(credentials)
    expect(new SessionStore(transport()).getSnapshot().status).toBe('anonymous')
    expect(JSON.stringify(first.getSnapshot())).not.toContain('accessToken')
  })

  it('rechaza un token ya vencido antes de llamar a me', async () => {
    const me = vi.fn(async () => user)
    const session = new SessionStore(transport({ login: async () => token(NOW / 1000), me }))
    await expect(session.login(credentials)).rejects.toThrow('No se pudo iniciar sesión')
    expect(me).not.toHaveBeenCalled()
  })

  it('no publica una sesión si exp vence mientras espera a me', async () => {
    const late = deferred<Usuario>()
    const session = new SessionStore(transport({ me: () => late.promise }))
    const response = session.login(credentials)
    const rejection = expect(response).rejects.toThrow('No se pudo iniciar sesión')
    await Promise.resolve()
    vi.setSystemTime(NOW + 60_000)
    late.resolve(user)
    await rejection
    expect(session.getSnapshot().user).toBeNull()
  })

  it('un error privado tardío también se transforma en cancelación', async () => {
    let reject!: (error: Error) => void
    const late = new Promise<never>((_resolve, fail) => { reject = fail })
    const session = new SessionStore(transport())
    await session.login(credentials)
    const response = session.runAuthenticated(() => late)
    const rejection = expect(response).rejects.toMatchObject({ name: 'AbortError' })
    session.logout()
    reject(new Error('error de otra sesión'))
    await rejection
  })

  it('cancela un registro pendiente sin autenticar al resolver tarde', async () => {
    const late = deferred<Usuario>()
    const session = new SessionStore(transport({ register: () => late.promise }))
    const response = session.register(credentials)
    const rejection = expect(response).rejects.toMatchObject({ name: 'AbortError' })
    session.cancelAuthentication()
    late.resolve(user)
    await rejection
    expect(session.getSnapshot().status).toBe('anonymous')
  })

})
