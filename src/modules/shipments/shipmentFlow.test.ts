import { describe, expect, it } from 'vitest'
import { API_PREFIX } from '../../shared/config/api'
import type { HttpRequest } from '../../shared/http/httpClient'
import { createSessionHttpClient } from '../../shared/http/sessionHttpClient'
import { SessionStore } from '../auth/session/session'
import { mockPersonaForEmail, mockToken } from '../auth/mocks/personas'
import { tokenMock } from '../auth/mocks/auth.mock'
import type { Rol } from '../auth/types'
import { createShipmentMockRequest, DEMO_COURIER_ID } from './mocks/shipmentServer'
import { createShipmentService } from './services/shipmentService'
import { shipmentFromForm } from './validation'
import { validForm } from './mocks/formFixture'
import type { EnvioRequest, HistorialEvento } from './types'

const BASE = `${API_PREFIX.shipment}/envios`
async function client(role: Rol, send: HttpRequest) {
  const email = `${role.toLowerCase()}@example.com`
  const user = mockPersonaForEmail(email)
  const session = new SessionStore({ mode: 'mock', login: async () => ({ ...tokenMock, accessToken: mockToken(role) }), me: async () => user, register: async () => user })
  await session.login({ email, password: 'ficticia' })
  return { session, api: createShipmentService(createSessionHttpClient(session, send)) }
}
const raw = (send: HttpRequest, role: Rol) => <T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' = 'GET', body?: unknown) => send<T>(path, { method, body, headers: { Authorization: `Bearer ${mockToken(role)}` } })

describe('flujo crítico en servidor simulado', () => {
  it('CLIENTE crea, ADMIN asigna y REPARTIDOR entrega; asignar no agrega historial', async () => {
    const send = createShipmentMockRequest(0)
    const { api: cliente, session } = await client('CLIENTE', send)
    const created = await cliente.create(shipmentFromForm(validForm()))
    expect(created.estado).toBe('PENDIENTE')
    expect(created.repartidorId).toBeNull()
    expect(await cliente.history(created.id)).toHaveLength(1)
    session.logout()
    const { api: admin } = await client('ADMIN', send)
    await admin.assign(created.id, DEMO_COURIER_ID)
    expect(await admin.history(created.id)).toHaveLength(1)
    expect((await admin.detail(created.id)).estado).toBe('PENDIENTE')
    const { api: repartidor } = await client('REPARTIDOR', send)
    expect((await repartidor.list()).map((row) => row.id)).toContain(created.id)
    await repartidor.advance(created.id, 'EN_RUTA')
    await repartidor.advance(created.id, 'ENTREGADO')
    expect((await repartidor.history(created.id)).map((event) => event.estadoNuevo)).toEqual(['PENDIENTE', 'EN_RUTA', 'ENTREGADO'])
    expect((await repartidor.tracking(created.codigoSeguimiento)).id).toBe(created.id)
    expect(await repartidor.list('PENDIENTE')).toHaveLength(0)
  })

  it('un tracking conocido no hace público el envío ajeno y el email no prueba pertenencia', async () => {
    const send = createShipmentMockRequest(0)
    const request = raw(send, 'CLIENTE')
    await expect(request(`${BASE}/seguimiento/LT-MOCK-AJENO`)).rejects.toMatchObject({ status: 403 })
    const { api: admin } = await client('ADMIN', send)
    const created = await admin.create(shipmentFromForm(validForm())) // Mismo correo de contacto, distinto usuario creador.
    const { api: cliente } = await client('CLIENTE', send)
    expect((await cliente.list()).map((row) => row.id)).not.toContain(created.id)
    await expect(request(`${BASE}/${created.id}`)).rejects.toMatchObject({ status: 403 })
  })

  it('rechazos de rol, proveedor y transición no mutan envío ni historial', async () => {
    const send = createShipmentMockRequest(0)
    const { api: admin } = await client('ADMIN', send)
    const created = await admin.create(shipmentFromForm(validForm()))
    await expect(raw(send, 'CLIENTE')(`${BASE}/${created.id}/estado`, 'PATCH', { estado: 'EN_RUTA' })).rejects.toMatchObject({ status: 403 })
    await expect(admin.assign(created.id, '00000000-0000-4000-8000-000000000999')).rejects.toMatchObject({ status: 422 })
    await expect(admin.advance(created.id, 'EN_RUTA')).rejects.toMatchObject({ status: 422 })
    expect((await admin.detail(created.id)).repartidorId).toBeNull()
    expect(await admin.history(created.id)).toHaveLength(1)
    await admin.assign(created.id, DEMO_COURIER_ID)
    await admin.cancel(created.id)
    expect((await admin.detail(created.id)).estado).toBe('CANCELADO')
    await expect(admin.advance(created.id, 'EN_RUTA')).rejects.toMatchObject({ status: 422 })
    expect(await admin.history(created.id)).toHaveLength(2)
  })

  it('rechaza alta inválida y campos de identidad sin efectos parciales', async () => {
    const send = createShipmentMockRequest(0)
    const { api } = await client('CLIENTE', send)
    const count = (await api.list()).length
    const body: EnvioRequest = shipmentFromForm(validForm())
    await expect(api.create({ ...body, pesoKg: 1.2345 })).rejects.toMatchObject({ status: 400 })
    await expect(raw(send, 'CLIENTE')(BASE, 'POST', { ...body, cliente: { ...body.cliente, usuarioId: 'ajeno' } })).rejects.toMatchObject({ status: 403 })
    expect(await api.list()).toHaveLength(count)
  })

  it('no permite reabrir un estado terminal ni duplicar una transición', async () => {
    const send = createShipmentMockRequest(0)
    const { api } = await client('ADMIN', send)
    const created = await api.create(shipmentFromForm(validForm()))
    await api.assign(created.id, DEMO_COURIER_ID)
    await api.advance(created.id, 'EN_RUTA')
    await expect(api.advance(created.id, 'EN_RUTA')).rejects.toMatchObject({ status: 422 })
    await api.advance(created.id, 'ENTREGADO')
    await expect(api.cancel(created.id)).rejects.toMatchObject({ status: 422 })
    expect(await api.history(created.id)).toHaveLength(3)
    const history = await raw(send, 'ADMIN')<HistorialEvento[]>(`${BASE}/${created.id}/historial`)
    history.length = 0
    expect(await api.history(created.id)).toHaveLength(3)
  })
})
