import { API_PREFIX } from '../../shared/config/api'
import { RequestError } from '../../shared/http/httpError'
import type { HttpClient } from '../../shared/http/httpClient'
import { parseCourier, uuidValid } from '../couriers/contract'
import type { RepartidorRequest } from '../couriers/types'
import { ROLES } from '../auth/types'
import type { Usuario, UsuarioCreateRequest } from '../auth/types'

export interface WriteResult { status: number; data: unknown }
export function candidateId(data: unknown): string | null {
  if (!data || typeof data !== 'object' || !('id' in data) || typeof data.id !== 'string' || !uuidValid(data.id)) return null
  return data.id
}
function userDto(data: unknown, id: string): Usuario {
  const user = data as Usuario | null
  if (!user || user.id !== id || typeof user.email !== 'string' || !Array.isArray(user.roles) || !user.roles.length || user.roles.some((role) => !ROLES.includes(role))) throw new RequestError('response')
  return user
}
export function confirmedAssociation(result: WriteResult, id: string, userId: string): void {
  const data = result.data as { recursoId?: string; usuarioId?: string } | null
  if (result.status !== 200 || data?.recursoId !== id || data.usuarioId !== userId) throw new RequestError('response')
}

/** Solo endpoints existentes; no inventa GET de asociaciones Shipment ni búsqueda de usuarios. */
export function createAdminService(client: HttpClient) {
  const userBase = `${API_PREFIX.security}/usuarios`
  const courierBase = `${API_PREFIX.courier}/repartidores`
  return {
    createUser: (body: UsuarioCreateRequest, signal: AbortSignal) => client.request<WriteResult>(userBase, { method: 'POST', body, signal, includeStatus: true }),
    user: async (id: string, signal: AbortSignal) => userDto(await client.request(`${userBase}/${encodeURIComponent(id)}`, { signal }), id),
    createCourier: (body: RepartidorRequest, signal: AbortSignal) => client.request<WriteResult>(courierBase, { method: 'POST', body, signal, includeStatus: true }),
    courier: async (id: string, signal: AbortSignal) => {
      const row = parseCourier(await client.request(`${courierBase}/${encodeURIComponent(id)}`, { signal }))
      if (row.id !== id) throw new RequestError('response')
      return row
    },
    identity: async (id: string, signal: AbortSignal) => {
      const data = await client.request<{ repartidorId: string; usuarioId: string | null }>(`${courierBase}/${encodeURIComponent(id)}/usuario`, { signal })
      if (!data || data.repartidorId !== id || (data.usuarioId !== null && (typeof data.usuarioId !== 'string' || !uuidValid(data.usuarioId)))) throw new RequestError('response')
      return data
    },
    linkCourier: (id: string, userId: string, signal: AbortSignal) => client.request<WriteResult>(`${courierBase}/${encodeURIComponent(id)}/usuario`, { method: 'PUT', body: { usuarioId: userId }, signal, includeStatus: true }),
    linkShipment: (id: string, userId: string, signal: AbortSignal) => client.request<WriteResult>(`${API_PREFIX.shipment}/asociaciones/repartidores/${encodeURIComponent(id)}`, { method: 'PUT', body: { usuarioId: userId }, signal, includeStatus: true }),
    linkClient: (id: string, userId: string, signal: AbortSignal) => client.request<WriteResult>(`${API_PREFIX.shipment}/clientes/${encodeURIComponent(id)}/usuario`, { method: 'PUT', body: { usuarioId: userId }, signal, includeStatus: true }),
  }
}
export type AdminService = ReturnType<typeof createAdminService>
