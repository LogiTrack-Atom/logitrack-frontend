import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { AuthProvider } from '../auth/session/AuthProvider'
import { SessionStore } from '../auth/session/session'
import { tokenMock } from '../auth/mocks/auth.mock'
import { mockPersonaForEmail, mockToken } from '../auth/mocks/personas'
import type { Rol } from '../auth/types'
import { createSessionHttpClient } from '../../shared/http/sessionHttpClient'
import { HttpError, RequestError } from '../../shared/http/httpError'
import { ShipmentsPage } from './ShipmentsPage'
import { createShipmentMockRequest, DEMO_COURIER_ID } from './mocks/shipmentServer'
import { createShipmentService } from './services/shipmentService'
import type { ShipmentService } from './services/shipmentService'
import { validForm } from './mocks/formFixture'
import { envioMock } from './mocks/shipments.mock'
import type { Envio } from './types'
import { API_PREFIX } from '../../shared/config/api'

async function setup(role: Rol = 'CLIENTE', change?: (service: ShipmentService) => void) {
  const send = createShipmentMockRequest(0)
  if (role === 'REPARTIDOR') await send(`${API_PREFIX.shipment}/envios/${envioMock.id}/repartidor`, { method: 'PUT', body: { repartidorId: DEMO_COURIER_ID }, headers: { Authorization: `Bearer ${mockToken('ADMIN')}` } })
  const email = `${role.toLowerCase()}@example.com`
  const user = mockPersonaForEmail(email)
  const store = new SessionStore({ mode: 'mock', login: async () => ({ ...tokenMock, accessToken: mockToken(role) }), me: async () => user, register: async () => user })
  await store.login({ email, password: 'ficticia' })
  const service = createShipmentService(createSessionHttpClient(store, send))
  change?.(service)
  const view = render(<AuthProvider store={store}><ShipmentsPage service={service} /></AuthProvider>)
  return { store, service, ...view }
}
function fillCreate() {
  const form = screen.getByRole('button', { name: 'Registrar envío' }).closest('form')!
  for (const [key, value] of validForm().entries()) fireEvent.change(form.querySelector(`[name="${key}"]`)!, { target: { value } })
  return form
}
afterEach(cleanup)

describe('espacio de envíos', () => {
  it('CLIENTE ve propios, filtra lista vacía y consulta tracking e historial', async () => {
    await setup()
    await screen.findByRole('button', { name: 'Ver LT-MOCK-0001' })
    expect(screen.queryByText('LT-MOCK-AJENO')).toBeNull()
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'ENTREGADO' } })
    await screen.findByText('No hay envíos visibles para el filtro seleccionado.')
    fireEvent.change(screen.getByLabelText('Código o UUID'), { target: { value: 'LT-MOCK-0001' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar envío' }))
    await screen.findByRole('list', { name: 'Historial de estados' })
    expect(screen.queryByRole('button', { name: 'Asignar repartidor' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Pasar a EN_RUTA' })).toBeNull()
    expect(within(screen.getByRole('list', { name: 'Historial de estados' })).getAllByRole('listitem')).toHaveLength(1)
  })

  it('bloquea un doble submit inmediatamente y solo confirma una respuesta exitosa', async () => {
    let resolve!: (envio: Envio) => void
    const late = new Promise<Envio>((done) => { resolve = done })
    const create = vi.fn(() => late)
    await setup('CLIENTE', (service) => { service.create = create })
    const form = fillCreate()
    fireEvent.submit(form); fireEvent.submit(form)
    expect(create).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Registrando…' })).toHaveProperty('disabled', true)
    await act(async () => { resolve({ ...envioMock, repartidorId: null }); await late })
    await screen.findByText('Alta confirmada: LT-MOCK-0001.')
    expect(screen.getByLabelText('Nombre')).toHaveProperty('value', '')
  })

  it.each([500, 502, 503, 504])('un HTTP %i en alta exige reconciliar antes de otra escritura', async (status) => {
    const create = vi.fn(async () => { throw new HttpError(status) })
    await setup('CLIENTE', service => { service.create = create })
    const form = fillCreate()
    fireEvent.submit(form)
    await screen.findByText('El alta no está confirmada. Revisá el listado antes de volver a crear: repetir podría duplicar el envío.')
    expect(screen.getByRole('button', { name: 'Registrar envío' })).toHaveProperty('disabled', true)
    fireEvent.submit(form)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it.each([500, 502, 503, 504])('un HTTP %i al cancelar bloquea repetir hasta releer el recurso', async (status) => {
    const cancel = vi.fn(async () => { throw new HttpError(status) })
    await setup('ADMIN', service => { service.cancel = cancel })
    fireEvent.click(await screen.findByRole('button', { name: 'Ver LT-MOCK-0001' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar envío' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar operación' }))
    await screen.findByText('Resultado no confirmado. Actualizá el detalle y verificá el estado antes de decidir otra operación.')
    expect(screen.getByRole('button', { name: 'Cancelar envío' }).closest('fieldset')).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar operación' }))
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it('no envía medidas inválidas ni redondea al registrar', async () => {
    const create = vi.fn()
    await setup('CLIENTE', (service) => { service.create = create })
    const form = fillCreate()
    fireEvent.change(screen.getByLabelText('Peso (kg)'), { target: { value: '1.2345' } })
    fireEvent.submit(form)
    expect(screen.getByRole('alert').textContent).toContain('3 decimales')
    expect(create).not.toHaveBeenCalled()
  })

  it('una falla de red en alta muestra resultado incierto y bloquea reintento automático', async () => {
    const create = vi.fn(async () => { throw new RequestError('network') })
    await setup('CLIENTE', (service) => { service.create = create })
    const form = fillCreate()
    fireEvent.submit(form)
    await screen.findByText('El alta no está confirmada. Revisá el listado antes de volver a crear: repetir podría duplicar el envío.')
    fireEvent.submit(form)
    expect(create).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Registrar envío' })).toHaveProperty('disabled', true)
    expect(screen.queryByText(/Alta confirmada:/)).toBeNull()
  })

  it('ADMIN asigna solo tras confirmar y el historial sigue teniendo un evento', async () => {
    const { service } = await setup('ADMIN')
    const assign = vi.spyOn(service, 'assign')
    fireEvent.click(await screen.findByRole('button', { name: 'Ver LT-MOCK-0001' }))
    await screen.findByRole('list', { name: 'Historial de estados' })
    fireEvent.change(screen.getByLabelText('UUID del repartidor'), { target: { value: DEMO_COURIER_ID } })
    fireEvent.click(screen.getByRole('button', { name: 'Asignar repartidor' }))
    expect(assign).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar operación' }))
    await screen.findByText(DEMO_COURIER_ID, { selector: 'dd' })
    expect(within(screen.getByRole('list', { name: 'Historial de estados' })).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByText('PENDIENTE', { selector: 'dd' })).toBeTruthy()
  })

  it('REPARTIDOR solo avanza sus asignaciones hasta ENTREGADO con tres eventos', async () => {
    await setup('REPARTIDOR')
    expect(screen.getByText('Panel del repartidor: envíos asignados a tu identidad.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Registrar envío' })).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: 'Ver LT-MOCK-0001' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Pasar a EN_RUTA' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar operación' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar ENTREGADO' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar operación' }))
    await screen.findByText('ENTREGADO', { selector: 'dd' })
    expect(within(screen.getByRole('list', { name: 'Historial de estados' })).getAllByRole('listitem')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Cancelar envío' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Marcar ENTREGADO' })).toBeNull()
  })

  it('descarta una lista tardía cuando el usuario ya cambió el filtro', async () => {
    let resolve!: (rows: Envio[]) => void
    const first = new Promise<Envio[]>((done) => { resolve = done })
    let calls = 0
    await setup('CLIENTE', (service) => { service.list = () => ++calls === 1 ? first : Promise.resolve([]) })
    fireEvent.change(screen.getByLabelText('Filtrar por estado'), { target: { value: 'ENTREGADO' } })
    await screen.findByText('No hay envíos visibles para el filtro seleccionado.')
    await act(async () => { resolve([envioMock]); await first })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Ver LT-MOCK-0001' })).toBeNull())
  })
})
