import { SessionStore } from '../../auth/session/session'
import { createMockIdentityDirectory } from '../../auth/mocks/identityDirectory'
import { tokenMock } from '../../auth/mocks/auth.mock'
import { mockToken } from '../../auth/mocks/personas'
import type { Rol } from '../../auth/types'
import { createDemoGateway } from '../../../shared/http/demoGateway'
import { createSessionHttpClient } from '../../../shared/http/sessionHttpClient'
import type { HttpRequest, RequestOptions } from '../../../shared/http/httpClient'
import { HttpError, RequestError } from '../../../shared/http/httpError'
import { API_PREFIX } from '../../../shared/config/api'
import { createAdminService } from '../adminService'
import { AdminFlowStore } from '../adminFlow'

export const account = { email: 'nuevo.repartidor@example.com', password: 'Ficticia-de-prueba-123', rol: 'REPARTIDOR' as const }
export const courier = { nombre: 'Repartidor ficticio nuevo', tipoVehiculo: 'Moto' }
export type FaultStep = 'user' | 'courier' | 'courierLink' | 'shipmentLink' | 'clientLink' | 'readUser' | 'readCourier'
const sessions: SessionStore[] = []
export function finishFixtures() { sessions.splice(0).forEach((session) => session.logout()) }
export async function fixture(role: Rol = 'ADMIN') {
  const directory = createMockIdentityDirectory(), gateway = createDemoGateway(0, directory)
  const actor = directory.byEmail(`${role.toLowerCase()}@example.com`)!
  const session = new SessionStore({ mode: 'mock', login: async () => ({ ...tokenMock, accessToken: mockToken(role) }), me: async () => actor, register: async () => actor })
  sessions.push(session)
  await session.login({ email: actor.email, password: 'ficticia' })
  const trace: { step: FaultStep | null; path: string; method: string }[] = []
  const captured = new Map<FaultStep, string>()
  let fault: { step: FaultStep; phase: 'before' | 'after' } | null = null
  function stepOf(path: string, options: RequestOptions = {}): FaultStep | null {
    const method = options.method ?? 'GET'
    if (method === 'POST' && path === `${API_PREFIX.security}/usuarios`) return 'user'
    if (method === 'GET' && path.startsWith(`${API_PREFIX.security}/usuarios/`)) return 'readUser'
    if (method === 'POST' && path === `${API_PREFIX.courier}/repartidores`) return 'courier'
    if (method === 'GET' && path.startsWith(`${API_PREFIX.courier}/repartidores/`) && !path.endsWith('/usuario')) return 'readCourier'
    if (method === 'PUT' && path.startsWith(API_PREFIX.courier) && path.endsWith('/usuario')) return 'courierLink'
    if (method === 'PUT' && path.includes('/asociaciones/repartidores/')) return 'shipmentLink'
    if (method === 'PUT' && path.includes('/clientes/')) return 'clientLink'
    return null
  }
  const send: HttpRequest = async <T,>(path: string, options: RequestOptions = {}) => {
    const step = stepOf(path, options)
    trace.push({ step, path, method: options.method ?? 'GET' })
    const hit = fault?.step === step ? fault : null
    if (hit) fault = null
    if (hit?.phase === 'before') throw new HttpError(422)
    const result = await gateway<T>(path, options)
    const data = (result as { data?: { id?: string } })?.data
    if (step && data?.id) captured.set(step, data.id)
    if (hit?.phase === 'after') throw new RequestError('network')
    return result
  }
  const client = createSessionHttpClient(session, send), api = createAdminService(client)
  const flow = new AdminFlowStore(session, api)
  return { session, directory, gateway, send, client, api, flow, trace, captured, count: (step: FaultStep) => trace.filter((event) => event.step === step).length,
    fail: (step: FaultStep, phase: 'before' | 'after') => { fault = { step, phase } } }
}
export type Fixture = Awaited<ReturnType<typeof fixture>>
export async function prepare(context: Fixture, until: 'user' | 'courier' | 'courierLink' | 'shipmentLink') {
  if (until === 'user') return
  await context.flow.createUser(account)
  if (until === 'courier') return
  await context.flow.createCourier(courier)
  if (until === 'courierLink') return
  await context.flow.linkCourier()
}
export function perform(context: Fixture, step: 'user' | 'courier' | 'courierLink' | 'shipmentLink') {
  if (step === 'user') return context.flow.createUser(account)
  if (step === 'courier') return context.flow.createCourier(courier)
  if (step === 'courierLink') return context.flow.linkCourier()
  return context.flow.linkShipment()
}
