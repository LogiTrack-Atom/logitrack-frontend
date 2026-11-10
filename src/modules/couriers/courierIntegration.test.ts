import { describe, expect, it, vi } from 'vitest'
import { API_PREFIX } from '../../shared/config/api'
import { createDemoGateway } from '../../shared/http/demoGateway'
import { createSessionHttpClient } from '../../shared/http/sessionHttpClient'
import type { HttpRequest } from '../../shared/http/httpClient'
import { SessionStore } from '../auth/session/session'
import { tokenMock } from '../auth/mocks/auth.mock'
import { mockToken, mockPersonaForEmail } from '../auth/mocks/personas'
import type { Rol } from '../auth/types'
import { createCourierService } from './services/courierService'
import { createShipmentService } from '../shipments/services/shipmentService'
import { envioMock } from '../shipments/mocks/shipments.mock'
import { repartidorMock } from './mocks/couriers.mock'

const BASE = `${API_PREFIX.courier}/repartidores`
async function setup(role: Rol, send: HttpRequest) {
  const user = mockPersonaForEmail(`${role.toLowerCase()}@example.com`)
  const store = new SessionStore({ mode: 'mock', login: async () => ({ ...tokenMock, accessToken: mockToken(role) }), me: async () => user, register: async () => user })
  await store.login({ email: user.email, password: 'ficticia' })
  const http = createSessionHttpClient(store, send)
  return { store, courier: createCourierService(http), shipment: createShipmentService(http), http }
}
const options = (role: Rol) => ({ headers: { Authorization: `Bearer ${mockToken(role)}` } })

describe('Courier y Shipment sobre una simulación compartida', () => {
  it('alta y edición confirman datos con GET; filtro y disponibilidad coinciden', async () => {
    const send = createDemoGateway(0)
    const { courier } = await setup('ADMIN', send)
    const row = await courier.create({ nombre: ' Ana ', tipoVehiculo: ' Moto ' })
    expect(row).toMatchObject({ nombre: 'Ana', tipoVehiculo: 'Moto', estado: 'ACTIVO' })
    expect(await courier.detail(row.id)).toEqual(row)
    const edited = await courier.update(row.id, { nombre: 'Ana Pérez', tipoVehiculo: 'Auto' })
    expect(edited).toMatchObject({ id: row.id, nombre: 'Ana Pérez', tipoVehiculo: 'Auto' })
    await courier.changeState(row.id, 'INACTIVO')
    expect((await courier.list('INACTIVO')).map((item) => item.id)).toEqual([row.id])
    expect(await courier.availability(row.id)).toMatchObject({ repartidorId: row.id, estado: 'INACTIVO', disponible: false })
  })

  it('un repartidor creado ACTIVO puede asignarse; INACTIVO se rechaza sin efectos parciales', async () => {
    const send = createDemoGateway(0)
    const { courier, shipment } = await setup('ADMIN', send)
    const row = await courier.create({ nombre: 'Ficticio', tipoVehiculo: 'Moto' })
    await courier.changeState(row.id, 'INACTIVO')
    await expect(shipment.assign(envioMock.id, row.id)).rejects.toMatchObject({ status: 422 })
    expect((await shipment.detail(envioMock.id)).repartidorId).toBeNull()
    expect(await shipment.history(envioMock.id)).toHaveLength(1)
    await courier.changeState(row.id, 'ACTIVO')
    await shipment.assign(envioMock.id, row.id)
    expect((await shipment.detail(envioMock.id)).repartidorId).toBe(row.id)
    expect(await shipment.history(envioMock.id)).toHaveLength(1)
  })

  it('desactivar después de asignar impide EN_RUTA; reactivar permite completar tres eventos', async () => {
    const send = createDemoGateway(0)
    const { courier, shipment } = await setup('ADMIN', send)
    await shipment.assign(envioMock.id, repartidorMock.id)
    await courier.changeState(repartidorMock.id, 'INACTIVO')
    await expect(shipment.advance(envioMock.id, 'EN_RUTA')).rejects.toMatchObject({ status: 422 })
    expect((await shipment.detail(envioMock.id)).estado).toBe('PENDIENTE')
    await courier.changeState(repartidorMock.id, 'ACTIVO')
    const { shipment: own } = await setup('REPARTIDOR', send)
    await own.advance(envioMock.id, 'EN_RUTA'); await own.advance(envioMock.id, 'ENTREGADO')
    expect((await own.history(envioMock.id)).map((event) => event.estadoNuevo)).toEqual(['PENDIENTE', 'EN_RUTA', 'ENTREGADO'])
  })

  it('CLIENTE no accede y REPARTIDOR no lista, escribe ni consulta fichas ajenas', async () => {
    const send = createDemoGateway(0)
    await expect(send(BASE, options('CLIENTE'))).rejects.toMatchObject({ status: 403 })
    await expect(send(BASE, options('REPARTIDOR'))).rejects.toMatchObject({ status: 403 })
    await expect(send(`${BASE}/00000000-0000-4000-8000-000000000202`, options('REPARTIDOR'))).rejects.toMatchObject({ status: 403 })
    await expect(send(`${BASE}/${repartidorMock.id}/estado`, { ...options('REPARTIDOR'), method: 'PATCH', body: { estado: 'INACTIVO' } })).rejects.toMatchObject({ status: 403 })
    const { courier } = await setup('REPARTIDOR', send)
    expect((await courier.detail(repartidorMock.id)).id).toBe(repartidorMock.id)
    expect((await courier.availability(repartidorMock.id)).disponible).toBe(true)
  })

  it('rechaza campos/valores inválidos y DELETE sin modificar recursos', async () => {
    const send = createDemoGateway(0)
    const { courier } = await setup('ADMIN', send)
    const before = await courier.list()
    await expect(send(BASE, { ...options('ADMIN'), method: 'POST', body: { nombre: 'x', tipoVehiculo: 'Moto', usuarioId: 'otro' } })).rejects.toMatchObject({ status: 400 })
    await expect(send(`${BASE}/${repartidorMock.id}`, { ...options('ADMIN'), method: 'PUT', body: { nombre: ' ', tipoVehiculo: 'Moto' } })).rejects.toMatchObject({ status: 400 })
    await expect(send(`${BASE}/${repartidorMock.id}`, { ...options('ADMIN'), method: 'DELETE' })).rejects.toMatchObject({ status: 404 })
    expect(await courier.list()).toEqual(before)
  })

  it('las respuestas son copias y un repositorio nuevo no comparte los datos de otra prueba', async () => {
    const { courier } = await setup('ADMIN', createDemoGateway(0))
    const row = await courier.detail(repartidorMock.id)
    row.nombre = 'mutado localmente'
    expect((await courier.detail(row.id)).nombre).toBe(repartidorMock.nombre)
    await courier.create({ nombre: 'Nuevo', tipoVehiculo: 'Auto' })
    const fresh = await setup('ADMIN', createDemoGateway(0))
    expect(await fresh.courier.list()).toHaveLength(2)
  })

  it('un cliente de la generación anterior no inicia el GET posterior con otra identidad', async () => {
    const send = createDemoGateway(0)
    const { store, http } = await setup('ADMIN', send)
    await store.login({ email: 'admin@example.com', password: 'ficticia' })
    const spy = vi.spyOn(store, 'runAuthenticated')
    await expect(http.request(BASE)).rejects.toMatchObject({ name: 'AbortError' })
    expect(spy).not.toHaveBeenCalled()
    expect(store.getSnapshot().status).toBe('authenticated')
  })
})
