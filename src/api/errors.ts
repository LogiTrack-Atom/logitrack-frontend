import axios from 'axios'

const human: Record<number, string> = {
  400: 'La solicitud contiene datos inválidos.',
  401: 'La sesión no es válida o expiró.',
  403: 'No tenés permisos para realizar esta acción.',
  404: 'No se encontró el recurso solicitado.',
  409: 'Existe un conflicto con los datos actuales.',
  422: 'La operación no cumple las reglas de negocio.',
  429: 'Demasiadas solicitudes. Probá más tarde.',
  502: 'El servicio recibió una respuesta inválida de otro componente.',
  503: 'Un servicio necesario no está disponible.',
}

export class PendingConfirmation extends Error {
  constructor() { super('La solicitud fue aceptada (202), pero todavía no está confirmada. No reintentes automáticamente.'); this.name = 'PendingConfirmation' }
}
export class UncertainResult extends Error {
  constructor() { super('La conexión se interrumpió y no se conoce el resultado. Comprobá el recurso antes de reintentar.'); this.name = 'UncertainResult' }
}

function safe(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const clean = value.replace(/[\r\n\t]/g, ' ').trim()
  if (!clean || clean.length > 220 || /bearer\s|eyJ[A-Za-z0-9_-]{12}|password|contrase[ñn]a|stacktrace/i.test(clean)) return undefined
  return clean
}

export function readableError(error: unknown): string {
  if (error instanceof PendingConfirmation || error instanceof UncertainResult) return error.message
  if (!axios.isAxiosError(error)) return error instanceof Error ? (safe(error.message) || 'Ocurrió un error inesperado.') : 'Ocurrió un error inesperado.'
  if (error.code === 'ERR_CANCELED') return 'Operación cancelada.'
  if (!error.response) return 'No fue posible comunicarse con el servidor. Revisá la conexión y el Gateway.'
  const code = error.response.status
  const data = error.response.data
  const obj = data && typeof data === 'object' ? data as Record<string, unknown> : {}
  const firstDetail = Array.isArray(obj.details) ? obj.details.map(safe).filter(Boolean).slice(0, 2).join(' · ') : ''
  const server = safe(obj.mensaje) || safe(obj.detail) || safe(obj.title)
  return `${human[code] || `Error HTTP ${code}.`}${firstDetail ? ` ${firstDetail}` : server ? ` ${server}` : ''}`
}
