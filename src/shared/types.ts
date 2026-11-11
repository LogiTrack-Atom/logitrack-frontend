/** UUID serializado como string opaco. */
export type Uuid = string

/** Instant ISO-8601 en UTC, por ejemplo "2026-11-09T12:00:00.000000Z". */
export type IsoInstant = string

/**
 * Cuerpo de error de los servicios (ApiError). PROVISIONAL: el Gateway puede devolver
 * otro formato, así que no hay que asumir que todo error trae esta forma.
 */
export interface ApiError {
  timestamp: IsoInstant
  status: number
  error: string
  mensaje: string
  detalles: string[]
}
