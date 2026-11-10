import { describe, expect, it } from 'vitest'
import { canListOrMutateCouriers, canSeeCourierModule, CourierContractError, normalizeCourierDraft, parseAvailability, parseCourier, parseCourierList } from '../src/features/courier/contract'

const id = '123e4567-e89b-42d3-a456-426614174000'
const otherId = '123e4567-e89b-42d3-a456-426614174001'
const valid = { id, nombre:'Juan Pérez',tipoVehiculo:'Moto',estado:'ACTIVO', createdAt:'2026-11-05T10:00:00Z',updatedAt:'2026-11-05T10:00:00Z' }

describe('S04-08 contrato Courier', () => {
  it('respeta campos de RepartidorResponse y la lista tipada', () => {
    expect(parseCourier(valid).estado).toBe('ACTIVO')
    expect(parseCourierList([valid])).toHaveLength(1)
  })
  it('rechaza cuerpos malformados, sin éxito falso', () => {
    expect(() => parseCourier({ id, estado:'ACTIVO' })).toThrow(CourierContractError)
    expect(() => parseCourierList({ content: [valid] })).toThrow(CourierContractError)
    expect(() => parseCourier({...valid, estado:'BORRADO'})).toThrow(CourierContractError)
  })
  it('valida nombre y vehículo conforme a @NotBlank @Size(255)', () => {
    expect(normalizeCourierDraft({nombre:' Ana ',tipoVehiculo:' Auto '})).toEqual({nombre:'Ana',tipoVehiculo:'Auto'})
    expect(() => normalizeCourierDraft({nombre:'',tipoVehiculo:'Moto'})).toThrow()
    expect(() => normalizeCourierDraft({nombre:'A'.repeat(256),tipoVehiculo:'Moto'})).toThrow()
  })
  it('disponibilidad solo equivale a ACTIVO y pertenece al ID consultado', () => {
    expect(parseAvailability({repartidorId:id,estado:'ACTIVO',disponible:true},id).disponible).toBe(true)
    expect(parseAvailability({repartidorId:id,estado:'INACTIVO',disponible:false},id).disponible).toBe(false)
    expect(() => parseAvailability({repartidorId:otherId,estado:'ACTIVO',disponible:true},id)).toThrow(CourierContractError)
    expect(() => parseAvailability({repartidorId:id,estado:'INACTIVO',disponible:true},id)).toThrow(CourierContractError)
  })
  it('CLIENTE no accede; REPARTIDOR tiene solo lectura; ADMIN puede mutar', () => {
    expect(canSeeCourierModule(['CLIENTE'])).toBe(false)
    expect(canSeeCourierModule(['REPARTIDOR'])).toBe(true)
    expect(canListOrMutateCouriers(['REPARTIDOR'])).toBe(false)
    expect(canListOrMutateCouriers(['ADMIN'])).toBe(true)
  })
})
