import { HttpError } from '../../../shared/http/httpError'
import type { HttpRequest, RequestOptions } from '../../../shared/http/httpClient'
import { API_PREFIX } from '../../../shared/config/api'
import { demoIdentities } from '../../auth/mocks/identityDirectory'
import type { MockIdentityDirectory } from '../../auth/mocks/identityDirectory'
import type { Usuario } from '../../auth/types'
import { envioMock, historialMock } from './shipments.mock'
import { decimalValue } from '../validation'
import type { Envio, EnvioRequest, EstadoEnvio, HistorialEvento } from '../types'

/** Identidad de dominio distinta del sub del usuario REPARTIDOR. */
export const DEMO_COURIER_ID = '00000000-0000-4000-8000-000000000201'
const CLIENT_ID = '00000000-0000-4000-8000-000000000002'
const COURIER_USER_ID = '00000000-0000-4000-8000-000000000003'
interface Row { envio: Envio; ownerId: string | null; history: HistorialEvento[] }

/**
 * Servidor simulado en memoria de la pestaña. Reutiliza fixtures de Gab y aplica permisos
 * y transiciones antes de mutar. No es persistencia ni aceptación de un backend real.
 */
export function createShipmentMockRequest(delayMs = 150, courier: { isActive: (id: string) => boolean; isLinkedTo: (userId: string, id: string) => boolean } = { isActive: (id) => id === DEMO_COURIER_ID, isLinkedTo: (userId, id) => userId === COURIER_USER_ID && id === DEMO_COURIER_ID }, identities: MockIdentityDirectory = demoIdentities): HttpRequest {
  const rows = new Map<string, Row>()
  const references = new Map([[DEMO_COURIER_ID, COURIER_USER_ID]])
  const seed = (id: string, ownerId: string, code: string) => rows.set(id, {
    envio: { ...structuredClone(envioMock), id, codigoSeguimiento: code, repartidorId: null, cliente: { ...structuredClone(envioMock.cliente), id: id === envioMock.id ? envioMock.cliente.id : '00000000-0000-4000-8000-000000000102' } }, ownerId,
    history: [structuredClone(historialMock[0])],
  })
  seed(envioMock.id, CLIENT_ID, envioMock.codigoSeguimiento)
  seed('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000005', 'LT-MOCK-AJENO')
  const admin = (user: Usuario) => user.roles.includes('ADMIN')
  const visible = (row: Row, user: Usuario) => admin(user) || (user.roles.includes('CLIENTE') && row.ownerId === user.id)
    || (user.roles.includes('REPARTIDOR') && row.envio.repartidorId !== null && references.get(row.envio.repartidorId) === user.id)
  const fail = (status: number): never => { throw new HttpError(status) }
  const now = () => new Date().toISOString()

  function handle(path: string, options: RequestOptions): unknown {
    const token = options.headers?.Authorization?.replace(/^Bearer /, '') ?? ''
    const user = identities.resolveToken(token)
    if (!user) return fail(401)
    const url = new URL(path, 'http://simulacion.invalid')
    const association = new RegExp(`^${API_PREFIX.shipment}/(asociaciones/repartidores|clientes)/([^/]+)(/usuario)?$`).exec(url.pathname)
    if (association) {
      if (!admin(user)) return fail(403)
      if (options.method !== 'PUT' || (association[1] === 'clientes') !== !!association[3]) return fail(404)
      const body = options.body as { usuarioId?: string } | undefined
      if (!body || Object.keys(body).some((key) => key !== 'usuarioId') || typeof body.usuarioId !== 'string') return fail(400)
      const id = association[2], userId = body.usuarioId
      if (association[1] === 'asociaciones/repartidores') {
        const current = references.get(id)
        if (current && current !== userId) return fail(409)
        if (!current) {
          const account = identities.find(userId)
          if (!account) return fail(404)
          if (!account.roles.includes('REPARTIDOR') || !courier.isLinkedTo(userId, id)) return fail(422)
          if ([...references.values()].includes(userId)) return fail(409)
          references.set(id, userId)
        }
      } else {
        const matching = [...rows.values()].filter((row) => row.envio.cliente.id === id)
        if (!matching.length) return fail(404)
        if (matching.some((row) => row.ownerId && row.ownerId !== userId)) return fail(409)
        const account = identities.find(userId)
        if (!account) return fail(404)
        if (!account.roles.includes('CLIENTE')) return fail(422)
        if ([...rows.values()].some((row) => row.ownerId === userId && row.envio.cliente.id !== id)) return fail(409)
        matching.forEach((row) => { row.ownerId = userId })
      }
      return { recursoId: id, usuarioId: userId }
    }
    const prefix = `${API_PREFIX.shipment}/envios`
    if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) return fail(404)
    const segments = url.pathname.slice(prefix.length).split('/').filter(Boolean).map(decodeURIComponent)
    const method = options.method ?? 'GET'
    if (segments.length === 0 && method === 'GET') {
      const estado = url.searchParams.get('estado')
      return [...rows.values()].filter((row) => visible(row, user) && (!estado || row.envio.estado === estado)).map((row) => row.envio)
    }
    if (segments.length === 0 && method === 'POST') {
      if (!admin(user) && !user.roles.includes('CLIENTE')) return fail(403)
      const body = options.body as EnvioRequest
      if (!body || Object.keys(body).some((key) => !['cliente', 'origen', 'destino', 'pesoKg', 'anchoCm', 'altoCm', 'largoCm'].includes(key))) return fail(400)
      if (!body.cliente?.nombre?.trim() || !body.cliente.email?.trim()
        || !body.origen || !body.destino || [body.origen, body.destino].some((address) => ['calle', 'numero', 'ciudad', 'codigoPostal'].some((key) => !String(address[key as keyof typeof address] ?? '').trim()))
        || [body.pesoKg, body.anchoCm, body.altoCm, body.largoCm].some((value) => !Number.isFinite(value) || value <= 0)) return fail(400)
      if (Object.keys(body.cliente).some((key) => !['nombre', 'email', 'telefono'].includes(key))) return fail(403)
      try {
        decimalValue(String(body.pesoKg), 7, 3)
        for (const value of [body.anchoCm, body.altoCm, body.largoCm]) decimalValue(String(value), 8, 2)
      } catch { return fail(400) }
      const id = crypto.randomUUID()
      const date = now()
      const envio: Envio = { ...structuredClone(body), id, codigoSeguimiento: `LT-MOCK-${id}`, cliente: { ...body.cliente, id: crypto.randomUUID(), telefono: body.cliente.telefono ?? null }, estado: 'PENDIENTE', repartidorId: null, createdAt: date, updatedAt: date }
      rows.set(id, { envio, ownerId: admin(user) ? null : user.id, history: [{ id: crypto.randomUUID(), estadoAnterior: null, estadoNuevo: 'PENDIENTE', fechaCambio: date }] })
      return envio
    }
    const row = segments[0] === 'seguimiento'
      ? [...rows.values()].find((row) => row.envio.codigoSeguimiento === segments[1])
      : rows.get(segments[0])
    if (!row) return fail(404)
    if (!visible(row, user)) return fail(403)
    if (method === 'GET' && ((segments.length === 1) || (segments[0] === 'seguimiento' && segments.length === 2))) return row.envio
    if (method === 'GET' && segments[1] === 'historial' && segments.length === 2) return row.history
    if (segments.length !== 2) return fail(404)
    const body = options.body as Record<string, unknown> | undefined
    if (method === 'PUT' && segments[1] === 'repartidor') {
      if (!admin(user)) return fail(403)
      if (row.envio.estado !== 'PENDIENTE' || typeof body?.repartidorId !== 'string' || !courier.isActive(body.repartidorId)) return fail(422)
      row.envio = { ...row.envio, repartidorId: body.repartidorId, updatedAt: now() }
      return row.envio // No cambia estado ni agrega historial.
    }
    if (method === 'PATCH' && ['estado', 'cancelacion'].includes(segments[1])) {
      const target = (segments[1] === 'cancelacion' ? 'CANCELADO' : body?.estado) as EstadoEnvio
      if ((!admin(user) && !user.roles.includes('REPARTIDOR')) || (target === 'CANCELADO' && !admin(user))) return fail(403)
      if (!(row.envio.estado === 'PENDIENTE' && ['EN_RUTA', 'CANCELADO'].includes(target)) && !(row.envio.estado === 'EN_RUTA' && target === 'ENTREGADO')) return fail(422)
      if (target === 'EN_RUTA' && (!row.envio.repartidorId || !courier.isActive(row.envio.repartidorId))) return fail(422)
      const date = now()
      row.history.push({ id: crypto.randomUUID(), estadoAnterior: row.envio.estado, estadoNuevo: target, fechaCambio: date })
      row.envio = { ...row.envio, estado: target, updatedAt: date }
      return row.envio
    }
    return fail(404)
  }

  return <T>(path: string, options: RequestOptions = {}): Promise<T> => new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', abort)
      reject(new DOMException('Solicitud cancelada.', 'AbortError'))
    }
    const timer = setTimeout(() => {
      options.signal?.removeEventListener('abort', abort)
      try { const data = handle(path, options); resolve(structuredClone(options.includeStatus ? { status: 200, data } : data) as T) } catch (error) { reject(error) }
    }, delayMs)
    options.signal?.addEventListener('abort', abort, { once: true })
    if (options.signal?.aborted) abort()
  })
}
