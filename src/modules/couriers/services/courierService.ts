import { parseCourier, parseCourierList, parseAvailability, CourierContractError } from '../contract'
import { createCourierConfirmed, updateCourierConfirmed, changeCourierStateConfirmed } from '../operations'
import type { CourierWritePort, CourierWriteResponse } from '../operations'
import { API_PREFIX } from '../../../shared/config/api'
import { integrationBlockedRequest as request } from '../../../shared/http/httpClient'
import { withMock } from '../../../shared/http/mock'
import { withQuery } from '../../../shared/http/url'
import type { Uuid } from '../../../shared/types'
import {
  disponibilidadMock,
  identidadRepartidorMock,
  repartidorMock,
  repartidoresMock,
} from '../mocks/couriers.mock'
import type {
  Disponibilidad,
  EstadoRepartidor,
  IdentidadRepartidor,
  Repartidor,
  RepartidorRequest,
} from '../types'

/**
 * PROVISIONAL: rutas y modelos del borrador de contratos (shipment-service#71).
 * Con los mocks activos no se hace ninguna llamada real.
 */
const BASE = `${API_PREFIX.courier}/repartidores`

export function listarRepartidores(estado?: EstadoRepartidor): Promise<Repartidor[]> {
  const mock = estado ? repartidoresMock.filter((r) => r.estado === estado) : repartidoresMock
  return withMock(mock, () => request<Repartidor[]>(withQuery(BASE, { estado })))
}

export function obtenerRepartidor(id: Uuid): Promise<Repartidor> {
  return withMock(repartidorMock, () => request<Repartidor>(`${BASE}/${encodeURIComponent(id)}`))
}

export function crearRepartidor(datos: RepartidorRequest): Promise<Repartidor> {
  return withMock({ ...repartidorMock, ...datos }, () =>
    request<Repartidor>(BASE, { method: 'POST', body: datos }),
  )
}

export function actualizarRepartidor(id: Uuid, datos: RepartidorRequest): Promise<Repartidor> {
  return withMock({ ...repartidorMock, ...datos }, () =>
    request<Repartidor>(`${BASE}/${encodeURIComponent(id)}`, { method: 'PUT', body: datos }),
  )
}

export function cambiarEstadoRepartidor(id: Uuid, estado: EstadoRepartidor): Promise<Repartidor> {
  return withMock({ ...repartidorMock, estado }, () =>
    request<Repartidor>(`${BASE}/${encodeURIComponent(id)}/estado`, {
      method: 'PATCH',
      body: { estado },
    }),
  )
}

export function obtenerDisponibilidad(id: Uuid): Promise<Disponibilidad> {
  return withMock(disponibilidadMock, () =>
    request<Disponibilidad>(`${BASE}/${encodeURIComponent(id)}/disponibilidad`),
  )
}

export function asociarUsuario(id: Uuid, usuarioId: Uuid): Promise<Repartidor> {
  return withMock(repartidorMock, () =>
    request<Repartidor>(`${BASE}/${encodeURIComponent(id)}/usuario`, {
      method: 'PUT',
      body: { usuarioId },
    }),
  )
}

export function obtenerIdentidad(id: Uuid): Promise<IdentidadRepartidor> {
  return withMock(identidadRepartidorMock, () =>
    request<IdentidadRepartidor>(`${BASE}/${encodeURIComponent(id)}/usuario`),
  )
}

/** Servicio privado adaptado al contrato de JMatiasF; confirma mutaciones mediante GET. */
export function createCourierService(client: import('../../../shared/http/httpClient').HttpClient) {
  const detail = async (id: string, signal?: AbortSignal) => {
    const row = parseCourier(await client.request(`${BASE}/${encodeURIComponent(id)}`, { signal }))
    if (row.id.toLowerCase() !== id.toLowerCase()) throw new CourierContractError()
    return row
  }
  const port = (signal?: AbortSignal): CourierWritePort => ({
    one: (id) => detail(id, signal),
    create: (nombre, tipoVehiculo) => client.request<CourierWriteResponse>(BASE, { method: 'POST', body: { nombre, tipoVehiculo }, includeStatus: true, signal }),
    update: (id, nombre, tipoVehiculo) => client.request<CourierWriteResponse>(`${BASE}/${encodeURIComponent(id)}`, { method: 'PUT', body: { nombre, tipoVehiculo }, includeStatus: true, signal }),
    state: (id, estado) => client.request<CourierWriteResponse>(`${BASE}/${encodeURIComponent(id)}/estado`, { method: 'PATCH', body: { estado }, includeStatus: true, signal }),
  })
  return {
    detail,
    list: async (estado?: EstadoRepartidor, signal?: AbortSignal) => parseCourierList(await client.request(withQuery(BASE, { estado }), { signal })),
    availability: async (id: string, signal?: AbortSignal) => parseAvailability(await client.request(`${BASE}/${encodeURIComponent(id)}/disponibilidad`, { signal }), id),
    create: (body: RepartidorRequest, signal?: AbortSignal) => createCourierConfirmed(port(signal), body),
    update: (id: string, body: RepartidorRequest, signal?: AbortSignal) => updateCourierConfirmed(port(signal), id, body),
    changeState: (id: string, estado: EstadoRepartidor, signal?: AbortSignal) => changeCourierStateConfirmed(port(signal), id, estado),
  }
}

export type CourierService = ReturnType<typeof createCourierService>
