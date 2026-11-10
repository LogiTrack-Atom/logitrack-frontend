import { API_PREFIX } from '../../../shared/config/api'
import { integrationBlockedRequest as request } from '../../../shared/http/httpClient'
import { withMock } from '../../../shared/http/mock'
import { withQuery } from '../../../shared/http/url'
import type { Uuid } from '../../../shared/types'
import {
  asociacionClienteMock,
  asociacionRepartidorMock,
  envioMock,
  enviosMock,
  historialMock,
} from '../mocks/shipments.mock'
import type {
  AsociacionUsuario,
  Envio,
  EnvioRequest,
  EstadoEnvio,
  HistorialEvento,
} from '../types'

/**
 * PROVISIONAL: rutas y modelos del borrador de contratos (shipment-service#71).
 * Con los mocks activos no se hace ninguna llamada real y los datos no dependen
 * de los argumentos (salvo el filtro de estado y el estado resultante).
 */
const BASE = `${API_PREFIX.shipment}/envios`

export function listarEnvios(estado?: EstadoEnvio): Promise<Envio[]> {
  const mock = estado ? enviosMock.filter((e) => e.estado === estado) : enviosMock
  return withMock(mock, () => request<Envio[]>(withQuery(BASE, { estado })))
}

export function obtenerEnvio(id: Uuid): Promise<Envio> {
  return withMock(envioMock, () => request<Envio>(`${BASE}/${encodeURIComponent(id)}`))
}

export function obtenerEnvioPorSeguimiento(codigoSeguimiento: string): Promise<Envio> {
  return withMock(envioMock, () =>
    request<Envio>(`${BASE}/seguimiento/${encodeURIComponent(codigoSeguimiento)}`),
  )
}

export function obtenerHistorial(id: Uuid): Promise<HistorialEvento[]> {
  return withMock(historialMock, () =>
    request<HistorialEvento[]>(`${BASE}/${encodeURIComponent(id)}/historial`),
  )
}

export function crearEnvio(datos: EnvioRequest): Promise<Envio> {
  const mock: Envio = {
    ...envioMock,
    ...datos,
    cliente: { ...envioMock.cliente, ...datos.cliente, telefono: datos.cliente.telefono ?? null },
    repartidorId: null,
    estado: 'PENDIENTE',
  }
  return withMock(mock, () => request<Envio>(BASE, { method: 'POST', body: datos }))
}

export function asignarRepartidor(id: Uuid, repartidorId: Uuid): Promise<Envio> {
  const mock: Envio = { ...envioMock, repartidorId }
  return withMock(mock, () =>
    request<Envio>(`${BASE}/${encodeURIComponent(id)}/repartidor`, {
      method: 'PUT',
      body: { repartidorId },
    }),
  )
}

export function cambiarEstadoEnvio(id: Uuid, estado: EstadoEnvio): Promise<Envio> {
  const mock: Envio = { ...envioMock, estado }
  return withMock(mock, () =>
    request<Envio>(`${BASE}/${encodeURIComponent(id)}/estado`, {
      method: 'PATCH',
      body: { estado },
    }),
  )
}

/** Cancelación (solo ADMIN y solo envíos PENDIENTE), sin cuerpo. El escenario mock es provisional. */
export function cancelarEnvio(id: Uuid): Promise<Envio> {
  const mock: Envio = { ...envioMock, estado: 'CANCELADO' }
  return withMock(mock, () =>
    request<Envio>(`${BASE}/${encodeURIComponent(id)}/cancelacion`, { method: 'PATCH' }),
  )
}

export function asociarUsuarioACliente(clienteId: Uuid, usuarioId: Uuid): Promise<AsociacionUsuario> {
  return withMock({ ...asociacionClienteMock, usuarioId }, () =>
    request<AsociacionUsuario>(
      `${API_PREFIX.shipment}/clientes/${encodeURIComponent(clienteId)}/usuario`,
      { method: 'PUT', body: { usuarioId } },
    ),
  )
}

export function asociarUsuarioARepartidor(
  repartidorId: Uuid,
  usuarioId: Uuid,
): Promise<AsociacionUsuario> {
  return withMock({ ...asociacionRepartidorMock, usuarioId }, () =>
    request<AsociacionUsuario>(
      `${API_PREFIX.shipment}/asociaciones/repartidores/${encodeURIComponent(repartidorId)}`,
      { method: 'PUT', body: { usuarioId } },
    ),
  )
}

/** API de la pantalla: todos sus requests pasan por el cliente privado de sesión (#4). */
export function createShipmentService(client: import('../../../shared/http/httpClient').HttpClient) {
  return {
    list: (estado?: EstadoEnvio, signal?: AbortSignal) => client.request<Envio[]>(withQuery(BASE, { estado }), { signal }),
    detail: (id: string, signal?: AbortSignal) => client.request<Envio>(`${BASE}/${encodeURIComponent(id)}`, { signal }),
    tracking: (code: string, signal?: AbortSignal) => client.request<Envio>(`${BASE}/seguimiento/${encodeURIComponent(code)}`, { signal }),
    history: (id: string, signal?: AbortSignal) => client.request<HistorialEvento[]>(`${BASE}/${encodeURIComponent(id)}/historial`, { signal }),
    create: (body: EnvioRequest, signal?: AbortSignal) => client.request<Envio>(BASE, { method: 'POST', body, signal }),
    assign: (id: string, repartidorId: string, signal?: AbortSignal) => client.request<Envio>(`${BASE}/${encodeURIComponent(id)}/repartidor`, { method: 'PUT', body: { repartidorId }, signal }),
    advance: (id: string, estado: EstadoEnvio, signal?: AbortSignal) => client.request<Envio>(`${BASE}/${encodeURIComponent(id)}/estado`, { method: 'PATCH', body: { estado }, signal }),
    cancel: (id: string, signal?: AbortSignal) => client.request<Envio>(`${BASE}/${encodeURIComponent(id)}/cancelacion`, { method: 'PATCH', signal }),
  }
}

export type ShipmentService = ReturnType<typeof createShipmentService>
