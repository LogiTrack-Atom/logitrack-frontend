import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AuthProvider } from '../auth/session/AuthProvider'
import { SessionStore } from '../auth/session/session'
import { mockPersonaForEmail, mockToken } from '../auth/mocks/personas'
import { tokenMock } from '../auth/mocks/auth.mock'
import type { Rol } from '../auth/types'
import { createDemoGateway } from '../../shared/http/demoGateway'
import { createSessionHttpClient } from '../../shared/http/sessionHttpClient'
import { createCourierService } from './services/courierService'
import type { CourierService } from './services/courierService'
import { CouriersPage } from './CouriersPage'
import { repartidorMock } from './mocks/couriers.mock'
import { PendingConfirmation, UncertainResult } from './operations'
import type { Repartidor } from './types'

async function setup(role: Rol = 'ADMIN', adapt?: (service: CourierService) => void) {
  const user = mockPersonaForEmail(`${role.toLowerCase()}@example.com`)
  const store = new SessionStore({ mode: 'mock', login: async () => ({ ...tokenMock, accessToken: mockToken(role) }), me: async () => user, register: async () => user })
  await store.login({ email: user.email, password: 'ficticia' })
  const service = createCourierService(createSessionHttpClient(store, createDemoGateway(0)))
  adapt?.(service)
  render(<AuthProvider store={store}><CouriersPage service={service} /></AuthProvider>)
  return { store, service }
}
function fillCreate() {
  fireEvent.change(screen.getByLabelText('Nombre del nuevo repartidor'), { target: { value: 'Persona ficticia nueva' } })
  fireEvent.change(screen.getByLabelText('Vehículo del nuevo repartidor'), { target: { value: 'Moto' } })
  return screen.getByRole('button', { name: 'Crear repartidor' }).closest('form')!
}
afterEach(cleanup)

describe('Courier adaptado a la base compartida', () => {
  it('ADMIN crea, edita, desactiva y consulta disponibilidad confirmada', async () => {
    await setup()
    await screen.findByRole('button', { name: 'Ver Repartidor de ejemplo' })
    fireEvent.submit(fillCreate())
    await screen.findByText('Persona ficticia nueva', { selector: 'dd' })
    fireEvent.change(screen.getByLabelText('Nombre de la ficha'), { target: { value: 'Nombre actualizado' } })
    fireEvent.change(screen.getByLabelText('Vehículo de la ficha'), { target: { value: 'Auto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await screen.findByText('Nombre actualizado', { selector: 'dd' })
    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }))
    await screen.findByText('INACTIVO', { selector: 'dd' })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar disponibilidad' }))
    await screen.findByText('No disponible (INACTIVO). Es una observación; no reserva capacidad.')
    fireEvent.change(screen.getByLabelText('Filtrar repartidores por estado'), { target: { value: 'INACTIVO' } })
    await screen.findByRole('button', { name: 'Ver Nombre actualizado' })
    expect(screen.queryByRole('button', { name: 'Ver Repartidor de ejemplo' })).toBeNull()
    expect(screen.queryByRole('button', { name: /eliminar|borrar|delete/i })).toBeNull()
  })

  it('REPARTIDOR consulta su ficha en solo lectura sin pedir el listado', async () => {
    const list = vi.fn()
    await setup('REPARTIDOR', (service) => { service.list = list })
    fireEvent.change(screen.getByLabelText('UUID de la ficha Courier'), { target: { value: repartidorMock.id } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar ficha' }))
    await screen.findByText(repartidorMock.nombre, { selector: 'dd' })
    expect(list).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Crear repartidor' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Desactivar' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Consultar disponibilidad' }))
    await screen.findByText('Disponible (ACTIVO). Es una observación; no reserva capacidad.')
  })

  it('una ficha ajena produce 403 y termina la sesión antes de mostrar datos', async () => {
    const { store } = await setup('REPARTIDOR')
    fireEvent.change(screen.getByLabelText('UUID de la ficha Courier'), { target: { value: '00000000-0000-4000-8000-000000000202' } })
    fireEvent.click(screen.getByRole('button', { name: 'Consultar ficha' }))
    await screen.findByRole('heading', { name: 'Acceso no permitido' })
    expect(store.getSnapshot()).toMatchObject({ status: 'anonymous', user: null })
    expect(screen.queryByText('Otro repartidor ficticio', { selector: 'dd' })).toBeNull()
  })

  it('bloquea doble submit inmediato sin suponer idempotencia del POST', async () => {
    let resolve!: (row: Repartidor) => void
    const promise = new Promise<Repartidor>((done) => { resolve = done })
    const create = vi.fn(() => promise)
    await setup('ADMIN', (service) => { service.create = create })
    const form = fillCreate()
    fireEvent.submit(form); fireEvent.submit(form)
    expect(create).toHaveBeenCalledTimes(1)
    await act(async () => { resolve(repartidorMock); await promise })
    await screen.findByText(repartidorMock.nombre, { selector: 'dd' })
  })

  it('202 pendiente bloquea otro POST hasta reconciliación explícita', async () => {
    const create = vi.fn(async () => { throw new PendingConfirmation() })
    await setup('ADMIN', (service) => { service.create = create })
    const form = fillCreate()
    fireEvent.submit(form)
    await screen.findByText('El alta pudo haberse realizado. Revisá el directorio antes de volver a enviar POST.')
    fireEvent.submit(form)
    expect(create).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Crear repartidor' }).matches(':disabled')).toBe(true)
  })

  it('un PATCH incierto se reconcilia con GET sin repetir la escritura', async () => {
    const changeState = vi.fn(async () => { throw new UncertainResult() })
    let reads = 0
    await setup('ADMIN', (service) => {
      service.changeState = changeState
      service.detail = async () => ({ ...repartidorMock, estado: ++reads === 1 ? 'ACTIVO' : 'INACTIVO' })
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Ver Repartidor de ejemplo' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Desactivar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Verificar recurso persistido' }))
    await screen.findByText('Operación confirmada mediante lectura del recurso.')
    expect(screen.getByText('INACTIVO', { selector: 'dd' })).toBeTruthy()
    expect(changeState).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Verificar recurso persistido' })).toBeNull()
  })

  it('descarta una lista tardía después de cambiar el filtro', async () => {
    let resolve!: (rows: Repartidor[]) => void
    const promise = new Promise<Repartidor[]>((done) => { resolve = done })
    let calls = 0
    await setup('ADMIN', (service) => { service.list = () => ++calls === 1 ? promise : Promise.resolve([]) })
    fireEvent.change(screen.getByLabelText('Filtrar repartidores por estado'), { target: { value: 'INACTIVO' } })
    await screen.findByText('No hay repartidores para el filtro seleccionado.')
    await act(async () => { resolve([repartidorMock]); await promise })
    expect(screen.queryByRole('button', { name: 'Ver Repartidor de ejemplo' })).toBeNull()
  })
})
