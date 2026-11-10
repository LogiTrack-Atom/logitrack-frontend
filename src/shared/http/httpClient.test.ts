import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_PREFIX } from '../config/api'
import { gatewayUrl } from './gatewayUrl'
import { HttpError, RequestError, userErrorMessage } from './httpError'
import { request } from './httpClient'

const PATH = `${API_PREFIX.shipment}/envios`
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules() })

describe('destino Gateway y propagación de credenciales', () => {
  it('acepta origen único y un Gateway cross-origin configurado explícitamente', () => {
    expect(gatewayUrl(`${PATH}?estado=PENDIENTE`, '', 'https://app.example.com')).toBe(`${PATH}?estado=PENDIENTE`)
    expect(gatewayUrl(PATH, 'https://gateway.example.com', 'https://app.example.com')).toBe(`https://gateway.example.com${PATH}`)
    expect(gatewayUrl(`https://gateway.example.com${PATH}`, 'https://gateway.example.com')).toBe(`https://gateway.example.com${PATH}`)
  })

  it.each([
    `https://tercero.example.com${PATH}`, `//tercero.example.com${PATH}`, `https://gateway.example.com.evil.test${PATH}`,
    `https://usuario:clave@gateway.example.com${PATH}`, `${PATH}#fragmento`, '/applications/apishipment/api/v10/envios',
    '/applications/apishipment/api/v1/../admin', '/applications/apishipment/api/v1/%2e%2e/admin',
    '/applications/apishipment/api/v1/%252e%252e/admin', '/applications/apishipment/api/v1/%2fadmin',
    '/applications/apishipment/api/v1/\\admin', '/applications/apishipment/api/v1/%5cadmin',
    '/applications/apishipment/api/v1/%00admin', '/applications/apishipment/api/v1/%zz',
    'applications/apishipment/api/v1/envios', '/otra-api', `${PATH}\n`,
  ])('rechaza rutas ambiguas o no autorizadas: %s', (path) => {
    expect(() => gatewayUrl(path, 'https://gateway.example.com')).toThrow(RequestError)
  })

  it.each(['https://usuario:clave@gateway.example.com', 'https://gateway.example.com/ruta', 'https://gateway.example.com?key=valor', 'file:///tmp/', '//gateway.example.com'])('rechaza configuración de base inválida: %s', (base) => {
    expect(() => gatewayUrl(PATH, base)).toThrow(RequestError)
  })

  it('no llama fetch para un destino externo, aun con Authorization', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await expect(request('https://tercero.example.com', { headers: { Authorization: 'Bearer sintetico' } })).rejects.toBeInstanceOf(RequestError)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('omite cookies, rechaza redirects y evita cachear respuestas privadas', async () => {
    const fetchSpy = vi.fn(async () => new Response('{"ok":true}', { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    expect(await request(PATH)).toEqual({ ok: true })
    expect(fetchSpy).toHaveBeenCalledWith(PATH, expect.objectContaining({ credentials: 'omit', redirect: 'error', cache: 'no-store' }))
  })
})

describe('respuestas y errores seguros', () => {
  it.each([400, 401, 403, 404, 409, 422, 502, 503])('status %i rechaza ApiError, ProblemDetail, HTML y cuerpo vacío', async (status) => {
    for (const body of [JSON.stringify({ status, mensaje: '<script>secreto</script>', detalles: ['clave'] }), JSON.stringify({ status, title: 'secreto', detail: '<img src=x onerror=alert(1)>' }), '<html>secreto</html>', '']) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status })))
      const error = await request(PATH).catch((cause: unknown) => cause)
      expect(error).toBeInstanceOf(HttpError)
      expect((error as HttpError).status).toBe(status)
      expect(userErrorMessage(error)).toBeTruthy()
      expect(JSON.stringify(error)).not.toMatch(/secreto|clave|<script|onerror/)
      expect(error).not.toHaveProperty('body')
    }
  })

  it.each(['', '<html>SPA fallback</html>', '{malformado'])('una respuesta 200 no JSON no se convierte en éxito: %s', async (body) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status: 200 })))
    await expect(request(PATH)).rejects.toMatchObject({ code: 'response' })
  })

  it('204 admite éxito sin cuerpo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    await expect(request<void>(PATH, { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('red caída muestra mensaje seguro y no reintenta automáticamente', async () => {
    const fetchSpy = vi.fn(async () => { throw new Error('token o credencial en detalle interno') })
    vi.stubGlobal('fetch', fetchSpy)
    const error = await request(PATH, { method: 'POST', body: { dato: 'ficticio' } }).catch((cause: unknown) => cause)
    expect(error).toMatchObject({ code: 'network' })
    expect(userErrorMessage(error)).toContain('verificá el resultado')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(userErrorMessage(error)).not.toContain('credencial')
  })

  it('cancelar antes del request no envía nada ni genera mensaje de error', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const controller = new AbortController()
    controller.abort()
    const error = await request(PATH, { signal: controller.signal }).catch((cause: unknown) => cause)
    expect(userErrorMessage(error)).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('las fachadas heredadas tampoco habilitan red al desactivar mocks', async () => {
    vi.stubEnv('VITE_USE_MOCKS', 'false')
    vi.resetModules()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const [auth, shipment, courier] = await Promise.all([
      import('../../modules/auth/services/authService'),
      import('../../modules/shipments/services/shipmentService'),
      import('../../modules/couriers/services/courierService'),
    ])
    for (const response of [auth.iniciarSesion({ email: 'demo@example.com', password: 'demo' }), shipment.listarEnvios(), courier.listarRepartidores()]) {
      await expect(response).rejects.toMatchObject({ code: 'integration' })
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })


  it('conserva status para distinguir una escritura 202 de una confirmada 201', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"id":"ficticio"}', { status: 202 })))
    await expect(request(PATH, { method: 'POST', body: {}, includeStatus: true })).resolves.toEqual({ status: 202, data: { id: 'ficticio' } })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })))
    await expect(request(PATH, { includeStatus: true })).resolves.toEqual({ status: 204, data: undefined })
  })

})
