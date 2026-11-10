/** Campos ficticios para las pruebas del formulario, sin datos reales. */
export function validForm() {
  const form = new FormData()
  for (const [key, value] of Object.entries({ nombre: 'Cliente ficticio', email: 'CLIENTE@example.com', telefono: '', pesoKg: '1.250', anchoCm: '25.25', altoCm: '15.50', largoCm: '30.75' })) form.set(key, value)
  for (const prefix of ['origen', 'destino']) for (const [key, value] of Object.entries({ calle: 'Ejemplo', numero: '123', ciudad: 'Jujuy', codigoPostal: '4600' })) form.set(`${prefix}.${key}`, value)
  return form
}

