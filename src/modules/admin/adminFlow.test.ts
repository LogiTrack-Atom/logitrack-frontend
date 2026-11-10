import { afterEach, describe, expect, it } from 'vitest'
import { fixture, finishFixtures, prepare, perform, account } from './testing/fixture'
import { createShipmentService } from '../shipments/services/shipmentService'
import { validForm } from '../shipments/mocks/formFixture'
import { shipmentFromForm } from '../shipments/validation'
import { createSessionHttpClient } from '../../shared/http/sessionHttpClient'
import { createAdminService } from './adminService'
import { AdminFlowStore } from './adminFlow'
import { API_PREFIX } from '../../shared/config/api'
import { mockToken } from '../auth/mocks/personas'
import { mockUserToken } from '../auth/mocks/identityDirectory'

afterEach(finishFixtures)
const stages = ['user', 'courier', 'courierLink', 'shipmentLink'] as const
const flags = { user: 'userConfirmed', courier: 'courierConfirmed', courierLink: 'courierLinked', shipmentLink: 'shipmentLinked' } as const

describe('recuperación de pasos administrativos', () => {
  it.each(stages)('fallo conocido antes de %s conserva los éxitos y permite solo ese paso', async (step) => {
    const f = await fixture(); await prepare(f, step)
    const before = f.flow.getSnapshot()
    f.fail(step, 'before'); await perform(f, step)
    const failed = f.flow.getSnapshot()
    expect(failed[flags[step]]).toBe(false)
    expect(failed.uncertain).toBeNull()
    expect(failed.userId).toBe(before.userId)
    expect(failed.courierId).toBe(before.courierId)
    await perform(f, step)
    expect(f.flow.getSnapshot()[flags[step]]).toBe(true)
    for (const earlier of stages.slice(0, stages.indexOf(step))) expect(f.count(earlier)).toBe(1)
  })

  it.each(['user', 'courier'] as const)('respuesta POST perdida de %s bloquea repetir y requiere recuperar ID externo', async (step) => {
    const f = await fixture(); await prepare(f, step)
    f.fail(step, 'after'); await perform(f, step)
    expect(f.flow.getSnapshot().uncertain).toBe(step)
    expect(f.flow.getSnapshot()[step === 'user' ? 'userId' : 'courierId']).toBeNull()
    await perform(f, step)
    expect(f.count(step)).toBe(1)
    const userId = step === 'user' ? f.captured.get('user')! : f.flow.getSnapshot().userId!
    await f.flow.recover(userId, step === 'courier' ? f.captured.get('courier')! : '')
    expect(f.flow.getSnapshot().uncertain).toBeNull()
    expect(f.flow.getSnapshot()[flags[step]]).toBe(true)
    expect(f.count(step)).toBe(1)
  })

  it.each(['user', 'courier'] as const)('conserva el ID recibido si falla el GET de confirmación de %s', async (step) => {
    const f = await fixture(); await prepare(f, step)
    // Un GET fallido tras POST no invalida el ID ya recibido.
    f.fail(step === 'user' ? 'readUser' : 'readCourier', 'before')
    await perform(f, step)
    expect(f.flow.getSnapshot()[step === 'user' ? 'userId' : 'courierId']).toBeTruthy()
    expect(f.flow.getSnapshot()[flags[step]]).toBe(false)
    await f.flow.reconcile()
    expect(f.flow.getSnapshot()[flags[step]]).toBe(true)
    expect(f.count(step)).toBe(1)
  })

  it('reconcilia PUT Courier perdido por GET sin repetir la escritura', async () => {
    const f = await fixture(); await prepare(f, 'courierLink')
    f.fail('courierLink', 'after'); await f.flow.linkCourier()
    expect(f.flow.getSnapshot()).toMatchObject({ uncertain: 'courierLink', courierLinked: false })
    await f.flow.reconcile()
    expect(f.flow.getSnapshot()).toMatchObject({ uncertain: null, courierLinked: true })
    expect(f.count('courierLink')).toBe(1)
  })

  it('un PUT Shipment perdido no se confirma por lecturas ajenas; permite repetir solo el mismo vínculo', async () => {
    const f = await fixture(); await prepare(f, 'shipmentLink')
    const before = f.flow.getSnapshot()
    f.fail('shipmentLink', 'after'); await f.flow.linkShipment()
    await f.flow.reconcile()
    expect(f.flow.getSnapshot()).toMatchObject({ uncertain: 'shipmentLink', shipmentLinked: false, userId: before.userId, courierId: before.courierId })
    await f.flow.linkShipment()
    expect(f.flow.getSnapshot()).toMatchObject({ uncertain: null, shipmentLinked: true })
    expect(f.count('shipmentLink')).toBe(2)
    expect(f.count('user')).toBe(1); expect(f.count('courier')).toBe(1)
    expect(f.trace.some((event) => event.method === 'GET' && event.path.includes('/asociaciones/'))).toBe(false)
  })

  it.each(['before', 'after'] as const)('recupera asociación opcional de cliente ante fallo %s', async (phase) => {
    const f = await fixture()
    const clientAccount = { ...account, email: 'cliente.nuevo@example.com', rol: 'CLIENTE' as const }
    await f.flow.createUser(clientAccount)
    const userId = f.flow.getSnapshot().userId!
    const shipment = createShipmentService(f.client)
    const created = await shipment.create(shipmentFromForm(validForm()))
    f.fail('clientLink', phase); await f.flow.linkClient(created.cliente.id, userId)
    expect(f.flow.getSnapshot().clientLinked).toBe(false)
    if (phase === 'after') {
      expect(f.flow.getSnapshot().uncertain).toBe('clientLink')
      await f.flow.linkClient(created.cliente.id, '00000000-0000-4000-8000-000000000002')
      expect(f.count('clientLink')).toBe(1)
      await f.flow.reconcile()
      expect(f.flow.getSnapshot().clientLinked).toBe(false)
    }
    await f.flow.linkClient(created.cliente.id, userId)
    expect(f.flow.getSnapshot()).toMatchObject({ clientLinked: true, uncertain: null })
    expect(f.count('user')).toBe(1)
  })

  it('no guarda contraseña/JWT en el snapshot ni en el directorio de identidades', async () => {
    const f = await fixture(); await f.flow.createUser(account)
    const data = JSON.stringify({ flow: f.flow.getSnapshot(), account: f.directory.find(f.flow.getSnapshot().userId!) })
    expect(data).not.toContain(account.password)
    expect(data).not.toMatch(/accessToken|password|Bearer/)
    await f.flow.createUser(account)
    expect(f.count('user')).toBe(1)
  })

  it('logout limpia IDs e invalida el flujo viejo; recuperar requiere nuevas lecturas', async () => {
    const f = await fixture(); await prepare(f, 'shipmentLink'); await f.flow.linkShipment()
    const ids = f.flow.getSnapshot()
    f.session.logout()
    expect(f.flow.getSnapshot()).toMatchObject({ userId: null, courierId: null, courierLinked: false, shipmentLinked: false })
    await f.session.login({ email: 'admin@example.com', password: 'ficticia' })
    await f.flow.createUser(account)
    expect(f.count('user')).toBe(1)
    const flow = new AdminFlowStore(f.session, createAdminService(createSessionHttpClient(f.session, f.send)))
    await flow.recover(ids.userId!, ids.courierId!)
    expect(flow.getSnapshot()).toMatchObject({ userConfirmed: true, courierConfirmed: true, courierLinked: true, shipmentLinked: false })
    await flow.linkShipment()
    expect(flow.getSnapshot().shipmentLinked).toBe(true)
  })

  it('cuenta y ficha recuperadas deben tener rol e identidad compatibles', async () => {
    const f = await fixture(); await f.flow.createUser(account)
    await f.flow.recover('00000000-0000-4000-8000-000000000002')
    expect(f.flow.getSnapshot().error).toBeTruthy()
    await f.flow.recover(f.flow.getSnapshot().userId!, '00000000-0000-4000-8000-000000000201')
    expect(f.flow.getSnapshot().courierLinked).toBe(false)
    expect(f.flow.getSnapshot().error).toContain('otra cuenta')
  })

  it('los nuevos IDs se vinculan sin inferir propiedad por correo y no se sobrescriben', async () => {
    const f = await fixture(); await prepare(f, 'shipmentLink'); await f.flow.linkShipment()
    const state = f.flow.getSnapshot()
    const newAccount = f.directory.find(state.userId!)!
    const options = { headers: { Authorization: `Bearer ${mockUserToken(newAccount)}` } }
    expect((await f.gateway<{ id: string }>(`${API_PREFIX.courier}/repartidores/${state.courierId}`, options)).id).toBe(state.courierId)
    await expect(f.gateway(`${API_PREFIX.courier}/repartidores/${state.courierId}/usuario`, { method: 'PUT', body: { usuarioId: '00000000-0000-4000-8000-000000000003' }, headers: { Authorization: `Bearer ${mockToken('ADMIN')}` } })).rejects.toMatchObject({ status: 409 })
  })

  it.each(['CLIENTE', 'REPARTIDOR'] as const)('%s no puede iniciar el flujo ni escribir usuarios', async (role) => {
    const f = await fixture(role)
    await f.flow.createUser(account)
    expect(f.count('user')).toBe(0)
    await expect(f.gateway(`${API_PREFIX.security}/usuarios`, { method: 'POST', body: account, headers: { Authorization: `Bearer ${mockToken(role)}` } })).rejects.toMatchObject({ status: 403 })
  })

  it('una respuesta de alta tardía tras logout no vuelve a guardar IDs ni inicia confirmaciones', async () => {
    const f = await fixture()
    let resolve!: (value: { status: number; data: unknown }) => void
    const late = new Promise<{ status: number; data: unknown }>((done) => { resolve = done })
    const flow = new AdminFlowStore(f.session, { ...f.api, createUser: () => late })
    const operation = flow.createUser(account)
    f.session.logout()
    resolve({ status: 201, data: { id: '00000000-0000-4000-8000-000000000003' } })
    await operation
    expect(flow.getSnapshot()).toMatchObject({ userId: null, courierId: null, busy: false, userConfirmed: false })
    expect(f.count('readUser')).toBe(0)
  })


  it('no confirma ni vincula una cuenta si el GET no coincide con el correo solicitado', async () => {
    const f = await fixture()
    const flow = new AdminFlowStore(f.session, { ...f.api, user: async (id, signal) => ({ ...await f.api.user(id, signal), email: 'otra.identidad@example.com' }) })
    await flow.createUser(account)
    expect(flow.getSnapshot()).toMatchObject({ userConfirmed: false, uncertain: 'user' })
    await flow.reconcile()
    expect(flow.getSnapshot().userConfirmed).toBe(false)
    expect(f.count('user')).toBe(1)
    expect(f.count('courierLink')).toBe(0)
  })

})
