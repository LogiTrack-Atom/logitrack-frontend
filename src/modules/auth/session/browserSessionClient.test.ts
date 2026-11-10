import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserLogin, browserLogout, browserRestore, LOGOUT_PENDING } from './browserSessionClient'

const credentials = { email: 'fixture@example.test', password: 'SoloPrueba-2026!' }
const token = { accessToken: 'fixture', tokenType: 'Bearer', expiresIn: 900 }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); window.localStorage.clear() })

describe('renovación del navegador', () => {
  it('login y refresh usan cookies solo en rutas de sesión, con cabecera CSRF y sin persistir tokens', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(token)))
    vi.stubGlobal('fetch', fetchSpy)
    await browserLogin(credentials, new AbortController().signal)
    await browserRestore(new AbortController().signal)
    expect(fetchSpy.mock.calls.map(call => (call as unknown[])[0])).toEqual([
      '/applications/apisecurity/api/v1/auth/session', '/applications/apisecurity/api/v1/auth/session/refresh',
    ])
    for (const call of fetchSpy.mock.calls) {
      const options = (call as unknown[])[1] as RequestInit
      expect(options).toMatchObject({ credentials: 'same-origin', redirect: 'error', cache: 'no-store' })
      expect((options.headers as Record<string, string>)['X-LogiTrack-Session']).toBe('1')
      expect((options.headers as Record<string, string>).Authorization).toBeUndefined()
    }
    expect(window.localStorage.length).toBe(0)
  })

  it('logout fallido conserva solo el marcador y la siguiente restauración completa logout sin pedir refresh', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('red') }))
    await expect(browserLogout()).rejects.toMatchObject({ code: 'network' })
    expect(window.localStorage.getItem(LOGOUT_PENDING)).toBe('1')
    const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchSpy)
    await expect(browserRestore(new AbortController().signal)).rejects.toMatchObject({ status: 401 })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith('/applications/apisecurity/api/v1/auth/session/logout', expect.anything())
    expect(window.localStorage.length).toBe(0)
  })

  it('no libera logout delante de un login pendiente aunque la UI cancele su resultado', async () => {
    let done!: (response: Response) => void
    const fetchSpy = vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { done = resolve }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchSpy)
    const controller = new AbortController()
    const login = browserLogin(credentials, controller.signal)
    const rejected = expect(login).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    controller.abort()
    const logout = browserLogout()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    done(new Response(JSON.stringify(token)))
    await rejected; await logout
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(window.localStorage.length).toBe(0)
  })
  it('aun sin almacenamiento intenta logout y no restaura silenciosamente la cookie', async () => {
    vi.resetModules()
    const { browserLogout: finish, browserRestore: restore } = await import('./browserSessionClient')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('sin almacenamiento') })
    const fetchSpy = vi.fn(async () => new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchSpy)
    await finish()
    await expect(restore(new AbortController().signal)).rejects.toMatchObject({ status: 401 })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(fetchSpy.mock.calls.every(call => String((call as unknown[])[0]).endsWith('/logout'))).toBe(true)
  })

})
