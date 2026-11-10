import { describe, expect, it } from 'vitest'
import { decimalValue, shipmentFromForm } from './validation'

import { validForm } from './mocks/formFixture'

describe('validación del alta de envíos', () => {
  it.each(['0', '-1', '1,25', '1e3', '1.2345', '10000000', 'NaN', 'Infinity', ''])('rechaza peso inválido sin redondear: %s', (value) => {
    expect(() => decimalValue(value, 7, 3)).toThrow()
  })
  it('admite los límites del contrato y conserva su valor JSON', () => {
    expect(JSON.stringify(decimalValue('9999999.999', 7, 3))).toBe('9999999.999')
    expect(JSON.stringify(decimalValue('99999999.99', 8, 2))).toBe('99999999.99')
    expect(() => decimalValue('25.255', 8, 2)).toThrow()
  })
  it('construye únicamente campos permitidos, con contacto normalizado', () => {
    const form = validForm()
    form.set('usuarioId', 'identidad-ajena'); form.set('estado', 'ENTREGADO')
    const body = shipmentFromForm(form)
    expect(Object.keys(body).sort()).toEqual(['cliente', 'origen', 'destino', 'pesoKg', 'anchoCm', 'altoCm', 'largoCm'].sort())
    expect(body.cliente).toEqual({ nombre: 'Cliente ficticio', email: 'cliente@example.com', telefono: null })
  })
  it('rechaza dirección vacía y correo inválido', () => {
    const form = validForm()
    form.set('origen.ciudad', '  ')
    expect(() => shipmentFromForm(form)).toThrow('Completá')
    form.set('origen.ciudad', 'Jujuy'); form.set('email', 'sin-correo')
    expect(() => shipmentFromForm(form)).toThrow('correo electrónico')
  })
})
