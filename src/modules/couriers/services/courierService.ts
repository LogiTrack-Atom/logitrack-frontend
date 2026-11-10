import { API_PREFIX } from '../../../shared/config/api'
import { request } from '../../../shared/http/httpClient'
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
