import axios from 'axios'
import type { AxiosResponse } from 'axios'
import { PendingConfirmation, UncertainResult } from '../../api/errors'
import type { Courier, CourierStatus } from '../../types'
import { normalizeCourierDraft, type CourierDraft } from './contract'

/** API minimal inyectable: tests sin red ni credenciales. */
export type CourierWritePort = {
  one: (id: string) => Promise<Courier>
  create: (nombre: string, tipoVehiculo: string) => Promise<AxiosResponse<Courier>>
  update: (id: string, nombre: string, tipoVehiculo: string) => Promise<AxiosResponse<Courier>>
  state: (id: string, estado: CourierStatus) => Promise<AxiosResponse<Courier>>
}

function isNoResponse(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response && error.code !== 'ERR_CANCELED'
}

function isAmbiguousServerError(error: unknown): boolean {
  return axios.isAxiosError(error) && typeof error.response?.status === 'number' && error.response.status >= 500
}

export function isUnconfirmedWrite(error: unknown): boolean {
  return error instanceof PendingConfirmation || error instanceof UncertainResult || isNoResponse(error) || isAmbiguousServerError(error)
}

function assertWriteStatus(response: AxiosResponse<Courier>, accepted: number): void {
  // Un 202 o 204 no acredita una escritura persistida.
  if (response.status !== accepted) throw new PendingConfirmation()
}

async function checkAfterWrite(port: CourierWritePort, id: string): Promise<Courier> {
  try { return await port.one(id) }
  catch { throw new UncertainResult() } // La escritura pudo haber persistido.
}

export async function createCourierConfirmed(port: CourierWritePort, raw: CourierDraft): Promise<Courier> {
  const draft = normalizeCourierDraft(raw)
  let response: AxiosResponse<Courier>
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
  let response: AxiosResponse<Courier>
  try { response = await port.update(id, draft.nombre, draft.tipoVehiculo) }
  catch (error) { if (isNoResponse(error)) throw new UncertainResult(); throw error }
  assertWriteStatus(response, 200)
  const persisted = await checkAfterWrite(port, id)
  if (persisted.nombre !== draft.nombre || persisted.tipoVehiculo !== draft.tipoVehiculo) throw new PendingConfirmation()
  return persisted
}

export async function changeCourierStateConfirmed(port: CourierWritePort, id: string, estado: CourierStatus): Promise<Courier> {
  let response: AxiosResponse<Courier>
  try { response = await port.state(id, estado) }
  catch (error) { if (isNoResponse(error)) throw new UncertainResult(); throw error }
  assertWriteStatus(response, 200)
  const persisted = await checkAfterWrite(port, id)
  if (persisted.estado !== estado) throw new PendingConfirmation()
  return persisted
}
