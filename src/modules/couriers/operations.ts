/** Adaptado de JMatiasF, e6622af: escritura + GET de confirmación, sin Axios ni otra sesión. */
import { HttpError, RequestError } from '../../shared/http/httpError'

export class PendingConfirmation extends RequestError {
  constructor() { super('response'); this.name = 'PendingConfirmation' }
}
export class UncertainResult extends RequestError {
  constructor() { super('response'); this.name = 'UncertainResult' }
}
export interface CourierWriteResponse { status: number; data: Courier }
import type { Repartidor as Courier, EstadoRepartidor as CourierStatus } from './types'
import { normalizeCourierDraft, type CourierDraft } from './contract'

/** API minimal inyectable: tests sin red ni credenciales. */
export type CourierWritePort = {
  one: (id: string) => Promise<Courier>
  create: (nombre: string, tipoVehiculo: string) => Promise<CourierWriteResponse>
  update: (id: string, nombre: string, tipoVehiculo: string) => Promise<CourierWriteResponse>
  state: (id: string, estado: CourierStatus) => Promise<CourierWriteResponse>
}

function isNoResponse(error: unknown): boolean {
  return error instanceof RequestError && error.code === 'network'
}

function isAmbiguousServerError(error: unknown): boolean {
  return error instanceof HttpError && error.status >= 500
}

export function isUnconfirmedWrite(error: unknown): boolean {
  return error instanceof RequestError && error.code === 'response' || isNoResponse(error) || isAmbiguousServerError(error)
}

function assertWriteStatus(response: CourierWriteResponse, accepted: number): void {
  // Un 202 o 204 no acredita una escritura persistida.
  if (response.status !== accepted) throw new PendingConfirmation()
}

async function checkAfterWrite(port: CourierWritePort, id: string): Promise<Courier> {
  try { return await port.one(id) }
  catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new UncertainResult()
  } // La escritura pudo haber persistido.
}

export async function createCourierConfirmed(port: CourierWritePort, raw: CourierDraft): Promise<Courier> {
  const draft = normalizeCourierDraft(raw)
  let response: CourierWriteResponse
  try { response = await port.create(draft.nombre, draft.tipoVehiculo) }
  catch (error) { if (isNoResponse(error)) throw new UncertainResult(); throw error }
  assertWriteStatus(response, 201)
  const id = response.data?.id
  if (!id) throw new UncertainResult()
  const persisted = await checkAfterWrite(port, id)
  if (persisted.nombre !== draft.nombre || persisted.tipoVehiculo !== draft.tipoVehiculo || persisted.estado !== 'ACTIVO') {
    throw new PendingConfirmation()
  }
  return persisted
}

export async function updateCourierConfirmed(port: CourierWritePort, id: string, raw: CourierDraft): Promise<Courier> {
  const draft = normalizeCourierDraft(raw)
  let response: CourierWriteResponse
  try { response = await port.update(id, draft.nombre, draft.tipoVehiculo) }
  catch (error) { if (isNoResponse(error)) throw new UncertainResult(); throw error }
  assertWriteStatus(response, 200)
  const persisted = await checkAfterWrite(port, id)
  if (persisted.nombre !== draft.nombre || persisted.tipoVehiculo !== draft.tipoVehiculo) throw new PendingConfirmation()
  return persisted
}

export async function changeCourierStateConfirmed(port: CourierWritePort, id: string, estado: CourierStatus): Promise<Courier> {
  let response: CourierWriteResponse
  try { response = await port.state(id, estado) }
  catch (error) { if (isNoResponse(error)) throw new UncertainResult(); throw error }
  assertWriteStatus(response, 200)
  const persisted = await checkAfterWrite(port, id)
  if (persisted.estado !== estado) throw new PendingConfirmation()
  return persisted
}
