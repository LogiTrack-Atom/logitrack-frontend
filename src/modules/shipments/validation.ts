import type { Direccion, EnvioRequest } from './types'

/** Conserva la entrada decimal hasta validarla; nunca redondea escala silenciosamente. */
export function decimalValue(raw: string, integers: number, fractions: number): number {
  if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error('Usá números positivos con punto decimal, sin exponentes ni comas.')
  const [whole, fraction = ''] = raw.split('.')
  if ((whole.replace(/^0+/, '') || '0').length > integers || fraction.length > fractions || Number(raw) <= 0) {
    throw new Error(`La medida debe ser positiva y admitir hasta ${integers} enteros y ${fractions} decimales.`)
  }
  return Number(raw)
}

/** Construye solo los campos del DTO público; no permite elegir identidad ni estado. */
export function shipmentFromForm(form: FormData): EnvioRequest {
  const text = (name: string) => String(form.get(name) ?? '').trim()
  const required = (name: string) => {
    const value = text(name)
    if (!value) throw new Error('Completá los datos del cliente y ambas direcciones.')
    return value
  }
  const address = (prefix: string): Direccion => ({ calle: required(`${prefix}.calle`), numero: required(`${prefix}.numero`), ciudad: required(`${prefix}.ciudad`), codigoPostal: required(`${prefix}.codigoPostal`) })
  const email = required('email').toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Ingresá un correo electrónico válido.')
  return {
    cliente: { nombre: required('nombre'), email, telefono: text('telefono') || null },
    origen: address('origen'), destino: address('destino'),
    pesoKg: decimalValue(text('pesoKg'), 7, 3),
    anchoCm: decimalValue(text('anchoCm'), 8, 2), altoCm: decimalValue(text('altoCm'), 8, 2), largoCm: decimalValue(text('largoCm'), 8, 2),
  }
}

export const isUuid = (value: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
