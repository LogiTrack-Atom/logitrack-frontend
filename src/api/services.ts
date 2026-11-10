import { api, endpoints, publicApi } from './client'
import type { Address, Association, Courier, CourierStatus, Role, Shipment, ShipmentCreate, ShipmentEvent, ShipmentStatus, TokenResponse, User } from '../types'
import { parseAvailability, parseCourier, parseCourierList } from '../features/courier/contract'

const s = endpoints.security
const c = endpoints.courier
const e = endpoints.shipment
const idPath = (value: string) => encodeURIComponent(value)

export const authApi = {
  login: async (email: string, password: string) => (await publicApi.post<TokenResponse>(`${s}/auth/login`, { email, password })).data,
  register: async (email: string, password: string) => (await publicApi.post<User>(`${s}/auth/register`, { email, password })).data,
  me: async () => (await api.get<User>(`${s}/auth/me`)).data,
  createUser: async (input: {email: string; password: string; rol: Role}) => (await api.post<User>(`${s}/usuarios`, input)).data,
  user: async (id: string) => (await api.get<User>(`${s}/usuarios/${idPath(id)}`)).data,
}

export const shipmentsApi = {
  list: async (estado?: ShipmentStatus | '') => (await api.get<Shipment[]>(`${e}/envios`, { params: estado ? { estado } : undefined })).data,
  one: async (id: string) => (await api.get<Shipment>(`${e}/envios/${idPath(id)}`)).data,
  track: async (code: string) => (await api.get<Shipment>(`${e}/envios/seguimiento/${idPath(code)}`)).data,
  history: async (id: string) => (await api.get<ShipmentEvent[]>(`${e}/envios/${idPath(id)}/historial`)).data,
  create: async (input: ShipmentCreate) => api.post<Shipment>(`${e}/envios`, input),
  assign: async (id: string, repartidorId: string) => api.put<Shipment>(`${e}/envios/${idPath(id)}/repartidor`, { repartidorId }),
  state: async (id: string, estado: ShipmentStatus) => api.patch<Shipment>(`${e}/envios/${idPath(id)}/estado`, { estado }),
  cancel: async (id: string) => api.patch<Shipment>(`${e}/envios/${idPath(id)}/cancelacion`),
  associateCustomer: async (id: string, usuarioId: string) => api.put<Association>(`${e}/clientes/${idPath(id)}/usuario`, { usuarioId }),
  associateCourier: async (id: string, usuarioId: string) => api.put<Association>(`${e}/asociaciones/repartidores/${idPath(id)}`, { usuarioId }),
}

export const courierApi = {
  list: async (estado?: CourierStatus | '') => parseCourierList((await api.get<unknown>(`${c}/repartidores`, { params: estado ? { estado } : undefined })).data),
  one: async (id: string) => parseCourier((await api.get<unknown>(`${c}/repartidores/${idPath(id)}`)).data),
  availability: async (id: string) => parseAvailability((await api.get<unknown>(`${c}/repartidores/${idPath(id)}/disponibilidad`)).data, id),
  create: async (nombre: string, tipoVehiculo: string) => api.post<Courier>(`${c}/repartidores`, { nombre, tipoVehiculo }),
  update: async (id: string, nombre: string, tipoVehiculo: string) => api.put<Courier>(`${c}/repartidores/${idPath(id)}`, { nombre, tipoVehiculo }),
  state: async (id: string, estado: CourierStatus) => api.patch<Courier>(`${c}/repartidores/${idPath(id)}/estado`, { estado }),
  associate: async (id: string, usuarioId: string) => api.put<Courier>(`${c}/repartidores/${idPath(id)}/usuario`, { usuarioId }),
  identity: async (id: string) => (await api.get<{repartidorId:string;usuarioId:string|null}>(`${c}/repartidores/${idPath(id)}/usuario`)).data,
}

export const emptyAddress = (): Address => ({calle: '', numero: '', ciudad: '', codigoPostal: ''})
