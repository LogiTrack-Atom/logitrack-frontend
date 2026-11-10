import type { SessionStore } from '../auth/session/session'
import type { Rol, UsuarioCreateRequest } from '../auth/types'
import type { RepartidorRequest } from '../couriers/types'
import { normalizeCourierDraft, uuidValid } from '../couriers/contract'
import { HttpError, RequestError, userErrorMessage } from '../../shared/http/httpError'
import { candidateId, confirmedAssociation } from './adminService'
import type { AdminService } from './adminService'
import { validateAccount } from './validation'

export type AdminStep = 'user' | 'courier' | 'courierLink' | 'shipmentLink' | 'clientLink'
export interface AdminSnapshot {
  userId: string | null; userEmail: string | null; role: Rol | null; userConfirmed: boolean
  courierId: string | null; courierConfirmed: boolean; courierLinked: boolean; shipmentLinked: boolean
  clientId: string | null; clientUserId: string | null; clientLinked: boolean
  uncertain: AdminStep | null; busy: boolean; error: string | null; note: string
}
const empty = (): AdminSnapshot => ({ userId: null, userEmail: null, role: null, userConfirmed: false, courierId: null, courierConfirmed: false, courierLinked: false, shipmentLinked: false, clientId: null, clientUserId: null, clientLinked: false, uncertain: null, busy: false, error: null, note: '' })
class FlowProblem extends Error {}
const uncertainError = (error: unknown) => error instanceof RequestError && ['network', 'response'].includes(error.code) || error instanceof HttpError && error.status >= 500
const requireId = (id: string) => { if (!uuidValid(id)) throw new FlowProblem('Ingresá un UUID confirmado válido.') }

/**
 * Coordina los pasos propuestos por JMatiasF (e6622af). Guarda solo IDs, rol y resultados;
 * no conserva contraseñas/JWT. La generación de sesión invalida y limpia todo el flujo.
 */
export class AdminFlowStore {
  #session: SessionStore
  #api: AdminService
  #epoch: number
  #state: Readonly<AdminSnapshot> = Object.freeze(empty())
  #listeners = new Set<() => void>()
  #operation: AbortController | null = null
  #serial = 0
  #unsubscribe: () => void = () => {}
  constructor(session: SessionStore, api: AdminService) {
    this.#session = session; this.#api = api; this.#epoch = session.getSnapshot().epoch
    this.#unsubscribe = session.subscribe(() => {
      if (session.getSnapshot().epoch !== this.#epoch) { this.reset(); this.#unsubscribe() }
    })
  }
  getSnapshot = () => this.#state
  subscribe = (listener: () => void) => { this.#listeners.add(listener); return () => { this.#listeners.delete(listener) } }
  #patch(data: Partial<AdminSnapshot>) { this.#state = Object.freeze({ ...this.#state, ...data }); this.#listeners.forEach((listener) => listener()) }
  reset = () => { this.#serial++; this.#operation?.abort(); this.#operation = null; this.#state = Object.freeze(empty()); this.#listeners.forEach((listener) => listener()) }
  #current(serial: number) { return serial === this.#serial && this.#session.getSnapshot().epoch === this.#epoch && this.#session.getSnapshot().status === 'authenticated' }
  async #run(step: AdminStep | 'read', work: (signal: AbortSignal, put: (data: Partial<AdminSnapshot>) => void) => Promise<void>) {
    if (this.#state.busy) return
    if (!this.#session.checkExpiry() || this.#session.getSnapshot().epoch !== this.#epoch || !this.#session.getSnapshot().user?.roles.includes('ADMIN')) { this.reset(); return }
    const serial = ++this.#serial, controller = new AbortController()
    this.#operation = controller
    const put = (data: Partial<AdminSnapshot>) => {
      if (!this.#current(serial) || controller.signal.aborted) throw new DOMException('Flujo cancelado.', 'AbortError')
      this.#patch(data)
    }
    put({ busy: true, error: null, note: '' })
    try { await work(controller.signal, put) }
    catch (error) {
      if (this.#current(serial) && !controller.signal.aborted) {
        const data: Partial<AdminSnapshot> = { error: error instanceof FlowProblem ? error.message : userErrorMessage(error) }
        if (step !== 'read' && uncertainError(error)) data.uncertain = step
        put(data)
      }
    } finally {
      if (this.#current(serial) && !controller.signal.aborted) put({ busy: false })
      if (this.#operation === controller) this.#operation = null
    }
  }
  createUser(data: UsuarioCreateRequest) {
    return this.#run('user', async (signal, put) => {
      if (this.#state.userId || this.#state.uncertain) throw new FlowProblem('El alta ya tiene un ID o resultado incierto. Reconciliá antes de continuar.')
      let body
      try { body = validateAccount(data) } catch { throw new FlowProblem('Revisá correo, rol y contraseña: 12 a 72 caracteres y hasta 72 bytes UTF-8.') }
      put({ role: body.rol, userEmail: body.email })
      const result = await this.#api.createUser(body, signal)
      const id = candidateId(result.data)
      if (id) put({ userId: id })
      if (result.status !== 201 || !id) throw new RequestError('response')
      const user = await this.#api.user(id, signal)
      if (!user.roles.includes(body.rol) || user.email !== body.email) throw new RequestError('response')
      put({ userConfirmed: true, uncertain: null, note: 'Cuenta confirmada mediante lectura.' })
    })
  }
  createCourier(data: RepartidorRequest) {
    return this.#run('courier', async (signal, put) => {
      if (!this.#state.userConfirmed || this.#state.role !== 'REPARTIDOR' || this.#state.courierId || this.#state.uncertain) throw new FlowProblem('Confirmá primero la cuenta REPARTIDOR y reconciliá cualquier alta pendiente.')
      let body
      try { body = normalizeCourierDraft(data) } catch { throw new FlowProblem('Nombre y vehículo son obligatorios, hasta 255 caracteres.') }
      const result = await this.#api.createCourier(body, signal)
      const id = candidateId(result.data)
      if (id) put({ courierId: id })
      if (result.status !== 201 || !id) throw new RequestError('response')
      const row = await this.#api.courier(id, signal)
      if (row.nombre !== body.nombre || row.tipoVehiculo !== body.tipoVehiculo || row.estado !== 'ACTIVO') throw new RequestError('response')
      put({ courierConfirmed: true, uncertain: null, note: 'Ficha Courier confirmada mediante lectura.' })
    })
  }
  async #read(signal: AbortSignal, put: (data: Partial<AdminSnapshot>) => void) {
    const { userId, courierId, role } = this.#state
    if (!userId) throw new FlowProblem('Necesitás recuperar un ID de cuenta confirmado externamente.')
    const user = await this.#api.user(userId, signal)
    if (role && !user.roles.includes(role) || this.#state.userEmail && user.email !== this.#state.userEmail) throw new FlowProblem('La cuenta no coincide con el rol o correo esperado.')
    put({ userConfirmed: true, userEmail: user.email, role: role ?? (user.roles.includes('REPARTIDOR') ? 'REPARTIDOR' : user.roles[0]), ...(this.#state.uncertain === 'user' ? { uncertain: null } : {}) })
    if (courierId) {
      if (!user.roles.includes('REPARTIDOR')) throw new FlowProblem('La ficha requiere una cuenta REPARTIDOR.')
      await this.#api.courier(courierId, signal)
      put({ courierConfirmed: true, ...(this.#state.uncertain === 'courier' ? { uncertain: null } : {}) })
      const identity = await this.#api.identity(courierId, signal)
      put({ courierLinked: identity.usuarioId === userId })
      if (identity.usuarioId && identity.usuarioId !== userId) throw new FlowProblem('Courier ya está vinculado a otra cuenta; no se sobrescribe.')
      if (this.#state.uncertain === 'courierLink') put({ uncertain: null })
    }
  }
  recover(userId: string, courierId = '') {
    userId = userId.trim().toLowerCase(); courierId = courierId.trim().toLowerCase()
    return this.#run('read', async (signal, put) => {
      requireId(userId); if (courierId) requireId(courierId)
      if (this.#state.userId && this.#state.userId !== userId || this.#state.courierId && this.#state.courierId !== courierId) throw new FlowProblem('No reemplaces IDs conocidos. Usá el mismo recurso o limpiá el flujo explícitamente.')
      const user = await this.#api.user(userId, signal)
      if (this.#state.role && !user.roles.includes(this.#state.role) || this.#state.userEmail && user.email !== this.#state.userEmail) throw new FlowProblem('La cuenta recuperada no coincide con el rol o correo esperado.')
      if (courierId && !user.roles.includes('REPARTIDOR')) throw new FlowProblem('La ficha requiere una cuenta REPARTIDOR.')
      put({ userId, userEmail: user.email, userConfirmed: true, ...(this.#state.uncertain === 'user' ? { uncertain: null } : {}), role: this.#state.role ?? (user.roles.includes('REPARTIDOR') ? 'REPARTIDOR' : user.roles[0]) })
      if (courierId) { await this.#api.courier(courierId, signal); put({ courierId }) }
      await this.#read(signal, put)
      put({ note: 'IDs revalidados. Solo se confirman vínculos que el contrato permite leer.' })
    })
  }
  reconcile() {
    return this.#run('read', async (signal, put) => {
      await this.#read(signal, put)
      put({ note: 'Lecturas confirmadas. Shipment no ofrece GET de asociación; un resultado incierto sigue pendiente.' })
    })
  }
  linkCourier() {
    return this.#run('courierLink', async (signal, put) => {
      if (!this.#state.userConfirmed || !this.#state.courierConfirmed || this.#state.role !== 'REPARTIDOR' || this.#state.uncertain && this.#state.uncertain !== 'courierLink') throw new FlowProblem('Confirmá los IDs de cuenta y ficha antes de vincular.')
      await this.#read(signal, put)
      if (this.#state.courierLinked) { put({ note: 'Courier ya confirmó este vínculo; no se repitió el PUT.' }); return }
      const { userId, courierId } = this.#state
      const result = await this.#api.linkCourier(courierId!, userId!, signal)
      if (result.status !== 200) throw new RequestError('response')
      const identity = await this.#api.identity(courierId!, signal)
      if (identity.usuarioId !== userId) throw new RequestError('response')
      put({ courierLinked: true, uncertain: null, note: 'Vínculo Courier confirmado mediante lectura.' })
    })
  }
  linkShipment() {
    return this.#run('shipmentLink', async (signal, put) => {
      if (!this.#state.courierLinked || this.#state.shipmentLinked || this.#state.uncertain && this.#state.uncertain !== 'shipmentLink') throw new FlowProblem('Confirmá el vínculo Courier antes de registrar la referencia en Shipment.')
      await this.#read(signal, put)
      if (!this.#state.courierLinked) throw new FlowProblem('Courier no confirma el vínculo esperado.')
      const { courierId, userId } = this.#state
      confirmedAssociation(await this.#api.linkShipment(courierId!, userId!, signal), courierId!, userId!)
      put({ shipmentLinked: true, uncertain: null, note: 'Shipment confirmó la referencia. No hay transacción distribuida.' })
    })
  }
  linkClient(clientId: string, userId: string) {
    clientId = clientId.trim().toLowerCase(); userId = userId.trim().toLowerCase()
    return this.#run('clientLink', async (signal, put) => {
      requireId(clientId); requireId(userId)
      if (this.#state.clientLinked || this.#state.uncertain && this.#state.uncertain !== 'clientLink') throw new FlowProblem('Reconciliá el paso pendiente antes de otro vínculo.')
      if (this.#state.uncertain === 'clientLink' && (clientId !== this.#state.clientId || userId !== this.#state.clientUserId)) throw new FlowProblem('El reintento debe conservar exactamente los mismos IDs.')
      const user = await this.#api.user(userId, signal)
      if (!user.roles.includes('CLIENTE')) throw new FlowProblem('La cuenta debe tener rol CLIENTE.')
      put({ clientId, clientUserId: userId })
      confirmedAssociation(await this.#api.linkClient(clientId, userId, signal), clientId, userId)
      put({ clientLinked: true, uncertain: null, note: 'Shipment confirmó la asociación del cliente.' })
    })
  }
}
