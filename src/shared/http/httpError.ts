const HTTP_MESSAGES: Record<number, string> = {
  400: 'Revisá los datos ingresados.',
  401: 'La sesión no es válida. Ingresá nuevamente.',
  403: 'No tenés permiso para realizar esta operación.',
  404: 'No se encontró el recurso solicitado.',
  409: 'La operación entra en conflicto con el estado actual. Actualizá los datos.',
  422: 'La operación no cumple las reglas de negocio. Revisá el estado del recurso.',
  502: 'El servicio recibió una respuesta inválida de su proveedor. Intentá más tarde.',
  503: 'El servicio no está disponible. Intentá más tarde.',
}

/** Error HTTP seguro: no retiene cuerpos ApiError/ProblemDetail ni credenciales reflejadas. */
export class HttpError extends Error {
  readonly status: number
  constructor(status: number) {
    super(HTTP_MESSAGES[status] ?? 'No se pudo completar la solicitud al servicio.')
    this.name = 'HttpError'
    this.status = status
  }
}

const REQUEST_MESSAGES = {
  network: 'No se pudo contactar al servicio. Si estabas guardando cambios, verificá el resultado antes de repetir la operación.',
  response: 'El servicio no devolvió la respuesta JSON esperada. Si estabas guardando cambios, verificá el resultado antes de repetir la operación.',
  destination: 'El destino solicitado no pertenece a la configuración permitida del Gateway.',
  integration: 'La operación requiere un cliente de sesión configurado para el Gateway.',
} as const

/** Fallas de transporte/configuración con mensajes fijos aptos para mostrar como texto. */
export class RequestError extends Error {
  readonly code: keyof typeof REQUEST_MESSAGES
  constructor(code: keyof typeof REQUEST_MESSAGES) {
    super(REQUEST_MESSAGES[code])
    this.name = 'RequestError'
    this.code = code
  }
}

/** No refleja mensajes arbitrarios del backend ni interpreta HTML. Abort no es un error de UI. */
export function userErrorMessage(error: unknown): string | null {
  if (error instanceof DOMException && error.name === 'AbortError') return null
  if (error instanceof HttpError) return HTTP_MESSAGES[error.status] ?? 'No se pudo completar la solicitud al servicio.'
  if (error instanceof RequestError) return REQUEST_MESSAGES[error.code]
  return 'No se pudo completar la operación.'
}
