/**
 * Contrato de asignación asíncrona (shipment-service#76): la operación que devuelve
 * el POST 202 y el GET /operaciones-asignacion/{operationId}.
 * Los estados salen del ADR de #76; ante un estado desconocido se descarta la respuesta.
 */
export const ASSIGNMENT_STATUSES = ['PENDING', 'APPLIED', 'REJECTED', 'SUPERSEDED', 'EXPIRED'] as const
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number]

export interface AssignmentOperation {
  operationId: string
  envioId: string
  repartidorId: string
  assignmentVersion: number
  status: AssignmentStatus
  reason: string | null
  createdAt: string
  updatedAt: string
  expiresAt: string
}

/** Intención del ADMIN: la misma clave de idempotencia se conserva hasta reconciliar. */
export interface AssignmentIntent {
  envioId: string
  repartidorId: string
  idempotencyKey: string
}

const KNOWN_STATUSES = new Set<string>(ASSIGNMENT_STATUSES)

function text(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/** Valida la forma mínima de la operación; devuelve null si no cumple el contrato. */
export function parseOperation(value: unknown): AssignmentOperation | null {
  if (typeof value !== 'object' || value === null) return null
  const { operationId, envioId, repartidorId, assignmentVersion, status, reason, createdAt, updatedAt, expiresAt } =
    value as Record<string, unknown>
  if (!text(operationId) || !text(envioId) || !text(repartidorId)) return null
  if (typeof assignmentVersion !== 'number' || !text(status) || !KNOWN_STATUSES.has(status)) return null
  if (!text(createdAt) || !text(updatedAt) || !text(expiresAt)) return null
  return {
    operationId,
    envioId,
    repartidorId,
    assignmentVersion,
    status: status as AssignmentStatus,
    reason: typeof reason === 'string' ? reason : null,
    createdAt,
    updatedAt,
    expiresAt,
  }
}
