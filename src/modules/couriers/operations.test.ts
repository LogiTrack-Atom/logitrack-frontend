/** Escenarios de confirmación aportados por JMatiasF (e6622af), sin dependencias nuevas. */
import { HttpError, RequestError } from '../../shared/http/httpError'
import { describe, expect, it, vi } from 'vitest'
import { PendingConfirmation, UncertainResult } from './operations'
import { changeCourierStateConfirmed, createCourierConfirmed, updateCourierConfirmed, type CourierWritePort } from './operations'
import type { Repartidor as Courier } from './types'
import type { CourierWriteResponse } from './operations'

const id = '123e4567-e89b-42d3-a456-426614174000'
const active: Courier = {id,nombre:'Juan',tipoVehiculo:'Moto',estado:'ACTIVO',createdAt:'2026-11-05T10:00:00Z',updatedAt:'2026-11-05T10:00:00Z'}
function response(data: Courier, status=200): CourierWriteResponse {
  return {status,data}
}
function port(): CourierWritePort {
  return { one:vi.fn().mockResolvedValue(active), create:vi.fn().mockResolvedValue(response(active,201)),update:vi.fn().mockResolvedValue(response(active)),state:vi.fn().mockResolvedValue(response(active)) }
}

describe('S04-08 escritura y confirmación', () => {
  it('POST 201 debe corroborar el alta persistida y ACTIVO', async () => {
    const api = port()
    const created = await createCourierConfirmed(api,{nombre:' Juan ',tipoVehiculo:'Moto'})
    expect(created).toEqual(active)
    expect(api.create).toHaveBeenCalledWith('Juan','Moto')
    expect(api.one).toHaveBeenCalledOnce()
    expect(api.one).toHaveBeenCalledWith(id)
  })
  it('POST 202 no es confirmación, nunca repite la escritura ni consulta GET', async () => {
    const api = port(); vi.mocked(api.create).mockResolvedValue(response(active,202))
    await expect(createCourierConfirmed(api,{nombre:'Juan',tipoVehiculo:'Moto'})).rejects.toBeInstanceOf(PendingConfirmation)
    expect(api.create).toHaveBeenCalledOnce()
    expect(api.one).not.toHaveBeenCalled()
  })
  it('POST con timeout deja el resultado incierto, sin reintento automático', async () => {
    const api = port(); vi.mocked(api.create).mockRejectedValue(new RequestError('network'))
    await expect(createCourierConfirmed(api,{nombre:'Juan',tipoVehiculo:'Moto'})).rejects.toBeInstanceOf(UncertainResult)
    expect(api.create).toHaveBeenCalledOnce()
  })
  it('PUT y PATCH comparan el estado devuelto por un GET posterior', async () => {
    const api = port()
    vi.mocked(api.one).mockResolvedValueOnce({...active,nombre:'María',tipoVehiculo:'Bici'}).mockResolvedValueOnce({...active,estado:'INACTIVO'})
    await expect(updateCourierConfirmed(api,id,{nombre:'María',tipoVehiculo:'Bici'})).resolves.toMatchObject({nombre:'María'})
    await expect(changeCourierStateConfirmed(api,id,'INACTIVO')).resolves.toMatchObject({estado:'INACTIVO'})
    expect(api.update).toHaveBeenCalledWith(id,'María','Bici')
    expect(api.state).toHaveBeenCalledWith(id,'INACTIVO')
  })
  it('no acepta respuesta GET incompatible con el estado solicitado', async () => {
    const api = port()
    await expect(changeCourierStateConfirmed(api,id,'INACTIVO')).rejects.toBeInstanceOf(PendingConfirmation)
    expect(api.state).toHaveBeenCalledOnce()
  })
  it('una caída al comprobar tras PUT no debe confundirse con fallo definitivo', async () => {
    const api = port();vi.mocked(api.one).mockRejectedValue(new Error('conexión'))
    await expect(updateCourierConfirmed(api,id,{nombre:'Juan',tipoVehiculo:'Moto'})).rejects.toBeInstanceOf(UncertainResult)
    expect(api.update).toHaveBeenCalledOnce()
  })
  it('un error HTTP 409 con respuesta se propaga al cliente de errores; no se reintenta', async () => {
    const api = port()
    const conflict = new HttpError(409)
    vi.mocked(api.update).mockRejectedValue(conflict)
    await expect(updateCourierConfirmed(api,id,{nombre:'Juan',tipoVehiculo:'Moto'})).rejects.toBe(conflict)
    expect(api.update).toHaveBeenCalledOnce()
  })
})
