import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionStore } from '../../modules/auth/session/session'
import { usuarioClienteMock, tokenMock } from '../../modules/auth/mocks/auth.mock'
import { API_PREFIX } from '../config/api'
import { HttpError } from './httpError'
import type { HttpRequest, RequestOptions } from './httpClient'
import { createSessionHttpClient } from './sessionHttpClient'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules() })

const PATH = `${API_PREFIX.shipment}/envios`
const credentials = { email: 'cliente@example.com', password: 'demo' }
async function signedIn() {
  const session = new SessionStore({ mode: 'mock', login: async () => tokenMock, me: async () => usuarioClienteMock, register: async () => usuarioClienteMock })
  await session.login(credentials)
  return session
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail })
  return { promise, resolve, reject }
}

function fakeRequest() {
  const spy = vi.fn<(path: string, options?: RequestOptions) => Promise<unknown>>(async () => [])
  const send: HttpRequest = async <T,>(path: string, options?: RequestOptions) => await spy(path, options) as T
  return { send, spy }
}

describe('requests vinculados a sesión', () => {
  it('adjunta el token vigente solo a una ruta permitida', async () => {
    const session = await signedIn()
    const { send, spy } = fakeRequest()
    const client = createSessionHttpClient(session, send)
    await expect(client.request(PATH)).resolves.toEqual([])
    expect(spy).toHaveBeenCalledWith(PATH, expect.objectContaining({ headers: { Authorization: `Bearer ${tokenMock.accessToken}` }, signal: expect.any(AbortSignal) }))
    await expect(client.request('https://externo.example.com')).rejects.toBeDefined()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('no permite reemplazar Bearer desde headers del consumidor', async () => {
    const session = await signedIn()
    const { send, spy } = fakeRequest()
    const client = createSessionHttpClient(session, send)
    await expect(client.request(PATH, { headers: { authorization: 'Bearer ajeno' } })).rejects.toMatchObject({ code: 'destination' })
    expect(spy).not.toHaveBeenCalled()
  })

  it('el modo de demostración no envía tokens ficticios por el transporte predeterminado', async () => {
    const session = await signedIn()
    await expect(createSessionHttpClient(session).request(PATH)).rejects.toMatchObject({ code: 'integration' })
  })

  it('el modo real usa fetch con el token privado y el prefijo del Gateway', async () => {
    vi.stubEnv('VITE_USE_MOCKS', 'false')
    vi.resetModules()
    const fetchSpy = vi.fn(async () => new Response('[]'))
    vi.stubGlobal('fetch', fetchSpy)
    const { createSessionHttpClient: realClient } = await import('./sessionHttpClient')
    const session = await signedIn()
    await expect(realClient(session).request(PATH)).resolves.toEqual([])
    expect(fetchSpy).toHaveBeenCalledWith(PATH, expect.objectContaining({
      credentials: 'omit', redirect: 'error',
      headers: expect.objectContaining({ Authorization: `Bearer ${tokenMock.accessToken}` }),
    }))
  })

  it('401 y 403 simultáneos limpian una sola vez, sin errores de la sesión anterior', async () => {
    const session = await signedIn()
    const logout = vi.spyOn(session, 'logout')
    const responses = [deferred<never>(), deferred<never>()]
    let index = 0
    const send: HttpRequest = () => responses[index++].promise
    const client = createSessionHttpClient(session, send)
    const results = Promise.allSettled([client.request(PATH), client.request(PATH)])
    responses[0].reject(new HttpError(401))
    responses[1].reject(new HttpError(403))
    expect((await results).every((result) => result.status === 'rejected' && result.reason.name === 'AbortError')).toBe(true)
    expect(logout).toHaveBeenCalledTimes(1)
    expect(session.getSnapshot()).toMatchObject({ status: 'anonymous', user: null, reason: 'unauthorized' })
  })

  it('un 403 viejo no cierra una sesión nueva', async () => {
    const session = await signedIn()
    const late = deferred<never>()
    const client = createSessionHttpClient(session, () => late.promise)
    const oldRequest = client.request(PATH)
    const rejection = expect(oldRequest).rejects.toMatchObject({ name: 'AbortError' })
    await session.login(credentials)
    const epoch = session.getSnapshot().epoch
    late.reject(new HttpError(403))
    await rejection
    expect(session.getSnapshot()).toMatchObject({ status: 'authenticated', epoch })
  })

  it('la cancelación de un consumidor descarta resultados aunque fetch no obedezca', async () => {
    const session = await signedIn()
    const late = deferred<unknown>()
    let received: RequestOptions | undefined
    const send: HttpRequest = <T,>(_path: string, options?: RequestOptions) => { received = options; return late.promise as Promise<T> }
    const client = createSessionHttpClient(session, send)
    const controller = new AbortController()
    const response = client.request(PATH, { signal: controller.signal })
    const rejection = expect(response).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    expect(received?.signal?.aborted).toBe(true)
    late.resolve('obsoleto')
    await rejection
    expect(session.getSnapshot().status).toBe('authenticated')
  })

  it.each([400, 409, 422, 502, 503])('un %i es error de operación y conserva la sesión', async (status) => {
    const session = await signedIn()
    const client = createSessionHttpClient(session, async () => { throw new HttpError(status) })
    await expect(client.request(PATH)).rejects.toMatchObject({ status })
    expect(session.getSnapshot().status).toBe('authenticated')
  })
})
