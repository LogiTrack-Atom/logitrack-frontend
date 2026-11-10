import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_PREFIX } from '../../../shared/config/api'
import { activeAuthTransport, gatewayAuthTransport } from './sessionClient'
import { usuarioClienteMock } from '../mocks/auth.mock'

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules() })

describe('transporte de autenticación', () => {
  it('usa solo los endpoints definidos y envía Bearer únicamente a me', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(usuarioClienteMock), { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    const signal = new AbortController().signal
    const data = { email: 'cliente@example.com', password: 'demostracion' }
    await gatewayAuthTransport.login(data, signal)
    await gatewayAuthTransport.me('valor-sintetico', signal)
    await gatewayAuthTransport.register(data, signal)
    expect(fetchSpy.mock.calls.map((call) => (call as unknown[])[0])).toEqual([
      `${API_PREFIX.security}/auth/login`, `${API_PREFIX.security}/auth/me`, `${API_PREFIX.security}/auth/register`,
    ])
    const options = fetchSpy.mock.calls.map((call) => (call as unknown[])[1] as RequestInit)
    expect(options.map((option) => option.method)).toEqual(['POST', 'GET', 'POST'])
    expect(options.map((option) => (option.headers as Record<string, string>).Authorization)).toEqual([undefined, 'Bearer valor-sintetico', undefined])
    expect(options.every((option) => option.signal === signal)).toBe(true)
    expect(JSON.parse(options[2].body as string)).toEqual(data)
  })

  it('la demostración activa no hace llamadas de red y puede abortarse', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const controller = new AbortController()
    const response = activeAuthTransport.login({ email: 'demo@example.com', password: 'demo' }, controller.signal)
    controller.abort()
    await expect(response).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('selecciona el adapter real al desactivar mocks explícitamente', async () => {
    vi.stubEnv('VITE_USE_MOCKS', 'false')
    vi.resetModules()
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ accessToken: 'fixture', tokenType: 'Bearer', expiresIn: 60 })))
    vi.stubGlobal('fetch', fetchSpy)
    const { activeAuthTransport: real, gatewayAuthTransport: adapter } = await import('./sessionClient')
    expect(real).toBe(adapter)
    await real.login({ email: 'demo@example.com', password: 'demo' }, new AbortController().signal)
    expect(fetchSpy).toHaveBeenCalledWith(`${API_PREFIX.security}/auth/login`, expect.objectContaining({ method: 'POST' }))
  })
})
