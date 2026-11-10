import { API_PREFIX } from '../../../shared/config/api'
import { HttpError } from '../../../shared/http/httpError'
import type { HttpRequest, RequestOptions } from '../../../shared/http/httpClient'
import { demoIdentities } from '../../auth/mocks/identityDirectory'
import type { MockIdentityDirectory } from '../../auth/mocks/identityDirectory'
import type { Repartidor, EstadoRepartidor } from '../types'
import { normalizeCourierDraft } from '../contract'
import { repartidorMock } from './couriers.mock'

/** Registro simulado Courier: identidad, disponibilidad dinámica y escrituras atómicas. */
export function createCourierMockRepository(delayMs = 150, identities: MockIdentityDirectory = demoIdentities) {
  const rows = new Map<string, Repartidor>([
    [repartidorMock.id, structuredClone(repartidorMock)],
    ['00000000-0000-4000-8000-000000000202', { ...structuredClone(repartidorMock), id: '00000000-0000-4000-8000-000000000202', nombre: 'Otro repartidor ficticio' }],
  ])
  const owners = new Map([
    [repartidorMock.id, '00000000-0000-4000-8000-000000000003'],
    ['00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000004'],
  ])
  const isActive = (id: string) => rows.get(id)?.estado === 'ACTIVO'
  const isLinkedTo = (userId: string, id: string) => owners.get(id) === userId
  const fail = (status: number): never => { throw new HttpError(status) }
  function handle(path: string, options: RequestOptions): { status: number; data: unknown } {
    const user = identities.resolveToken(options.headers?.Authorization?.replace(/^Bearer /, '') ?? '')
    if (!user) return fail(401)
    const admin = user.roles.includes('ADMIN')
    if (!admin && !user.roles.includes('REPARTIDOR')) return fail(403)
    const url = new URL(path, 'http://simulacion.invalid')
    const base = `${API_PREFIX.courier}/repartidores`
    if (url.pathname !== base && !url.pathname.startsWith(`${base}/`)) return fail(404)
    const parts = url.pathname.slice(base.length).split('/').filter(Boolean).map(decodeURIComponent)
    const method = options.method ?? 'GET'
    if (!admin && (parts.length === 0 || method !== 'GET')) return fail(403)
    if (method === 'GET' && parts.length === 0) {
      const estado = url.searchParams.get('estado')
      return { status: 200, data: [...rows.values()].filter((row) => !estado || row.estado === estado) }
    }
    if (method === 'POST' && parts.length === 0) {
      let draft
      try {
        const body = options.body as Record<string, unknown>
        if (!body || Object.keys(body).some((key) => !['nombre', 'tipoVehiculo'].includes(key)) || typeof body.nombre !== 'string' || typeof body.tipoVehiculo !== 'string') return fail(400)
        draft = normalizeCourierDraft({ nombre: body.nombre, tipoVehiculo: body.tipoVehiculo })
      } catch { return fail(400) }
      const id = crypto.randomUUID(), date = new Date().toISOString()
      const row: Repartidor = { ...draft, id, estado: 'ACTIVO', createdAt: date, updatedAt: date }
      rows.set(id, row)
      return { status: 201, data: row }
    }
    const row = rows.get(parts[0])
    if (!row) return fail(404)
    if (!admin && !isLinkedTo(user.id, row.id)) return fail(403)
    if (method === 'GET' && parts.length === 1) return { status: 200, data: row }
    if (method === 'GET' && parts.length === 2 && parts[1] === 'disponibilidad') return { status: 200, data: { repartidorId: row.id, estado: row.estado, disponible: isActive(row.id) } }
    if (parts.length === 2 && parts[1] === 'usuario') {
      if (!admin) return fail(403)
      if (method === 'GET') return { status: 200, data: { repartidorId: row.id, usuarioId: owners.get(row.id) ?? null } }
      if (method === 'PUT') {
        const body = options.body as { usuarioId?: string } | undefined
        if (!body || Object.keys(body).some((key) => key !== 'usuarioId') || typeof body.usuarioId !== 'string') return fail(400)
        const current = owners.get(row.id)
        if (current && current !== body.usuarioId) return fail(409)
        if (!current) {
          const account = identities.find(body.usuarioId)
          if (!account) return fail(404)
          if (!account.roles.includes('REPARTIDOR')) return fail(422)
          if ([...owners.values()].includes(body.usuarioId)) return fail(409)
          owners.set(row.id, body.usuarioId)
        }
        return { status: 200, data: row }
      }
    }
    if (method === 'PUT' && parts.length === 1) {
      let draft
      try {
        const body = options.body as Record<string, unknown>
        if (!body || Object.keys(body).some((key) => !['nombre', 'tipoVehiculo'].includes(key)) || typeof body.nombre !== 'string' || typeof body.tipoVehiculo !== 'string') return fail(400)
        draft = normalizeCourierDraft({ nombre: body.nombre, tipoVehiculo: body.tipoVehiculo })
      } catch { return fail(400) }
      const updated = { ...row, ...draft, updatedAt: new Date().toISOString() }
      rows.set(row.id, updated)
      return { status: 200, data: updated }
    }
    if (method === 'PATCH' && parts.length === 2 && parts[1] === 'estado') {
      const body = options.body as { estado?: EstadoRepartidor } | undefined
      if (!body || Object.keys(body).some((key) => key !== 'estado') || !['ACTIVO', 'INACTIVO'].includes(body.estado ?? '')) return fail(400)
      const updated: Repartidor = { ...row, estado: body.estado!, updatedAt: new Date().toISOString() }
      rows.set(row.id, updated)
      return { status: 200, data: updated }
    }
    return fail(404) // No existe DELETE ni /me de Courier.
  }
  const request: HttpRequest = <T>(path: string, options: RequestOptions = {}): Promise<T> => new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); reject(new DOMException('Solicitud cancelada.', 'AbortError')) }
    const timer = setTimeout(() => {
      options.signal?.removeEventListener('abort', abort)
      try {
        const result = handle(path, options)
        resolve(structuredClone(options.includeStatus ? result : result.data) as T)
      } catch (error) { reject(error) }
    }, delayMs)
    options.signal?.addEventListener('abort', abort, { once: true })
    if (options.signal?.aborted) abort()
  })
  return { request, isActive, isLinkedTo }
}
