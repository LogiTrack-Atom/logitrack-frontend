import { useAuth } from '../auth/session/authContext'
import type { SessionStore } from '../auth/session/session'
import { createSessionHttpClient } from '../../shared/http/sessionHttpClient'
import { demoGateway } from '../../shared/http/demoGateway'
import { createAdminService } from './adminService'
import { AdminFlowStore } from './adminFlow'

// Estado del flujo por sesión: navegar no pierde los IDs; logout limpia y vuelve inválida la instancia.
const flows = new WeakMap<SessionStore, { epoch: number; flow: AdminFlowStore }>()
export function useAdminFlow() {
  const { session, state } = useAuth()
  let entry = flows.get(session)
  if (!entry || entry.epoch !== state.epoch) {
    entry = { epoch: state.epoch, flow: new AdminFlowStore(session, createAdminService(createSessionHttpClient(session, demoGateway, state.epoch))) }
    flows.set(session, entry)
  }
  return entry.flow
}
