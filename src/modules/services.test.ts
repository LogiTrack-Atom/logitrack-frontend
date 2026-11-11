import { afterEach, describe, expect, it, vi } from 'vitest'
import { USE_MOCKS } from '../shared/config/env'
import { tokenMock } from './auth/mocks/auth.mock'
import {
  iniciarSesion,
  obtenerUsuario,
  obtenerUsuarioActual,
  registrarse,
} from './auth/services/authService'
import {
  listarRepartidores,
  obtenerDisponibilidad,
  obtenerRepartidor,
} from './couriers/services/courierService'
import {
  cambiarEstadoEnvio,
  listarEnvios,
  obtenerEnvio,
  obtenerHistorial,
} from './shipments/services/shipmentService'

const ID = '00000000-0000-4000-8000-000000000301'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('servicios con mocks activos', () => {
  it('los mocks están activos por defecto', () => {
    expect(USE_MOCKS).toBe(true)
  })

  it('ningún servicio hace llamadas de red', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    await Promise.all([
      listarEnvios(),
      obtenerEnvio(ID),
      obtenerHistorial(ID),
      listarRepartidores(),
      obtenerRepartidor(ID),
      obtenerDisponibilidad(ID),
      iniciarSesion({ email: 'cliente@example.com', password: 'no-real' }),
      registrarse({ email: 'cliente@example.com', password: 'no-real-no-real' }),
      obtenerUsuarioActual(),
      obtenerUsuario(ID),
    ])

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('el listado de envíos filtra por estado', async () => {
    expect(await listarEnvios('PENDIENTE')).toHaveLength(1)
    expect(await listarEnvios('ENTREGADO')).toHaveLength(0)
  })

  it('devuelve copias: modificar el resultado no altera el mock', async () => {
    const primero = await listarEnvios()
    primero[0].estado = 'CANCELADO'
    const segundo = await listarEnvios()
    expect(segundo[0].estado).toBe('PENDIENTE')
  })

  it('cambiar el estado refleja el estado pedido', async () => {
    expect((await cambiarEstadoEnvio(ID, 'EN_RUTA')).estado).toBe('EN_RUTA')
  })

  it('el token mock no tiene forma de JWT', () => {
    expect(tokenMock.accessToken.split('.')).not.toHaveLength(3)
  })
})
