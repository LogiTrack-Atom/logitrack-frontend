import { HttpError, RequestError } from '../../shared/http/httpError'
import { parseOperation } from './assignment'
import type { AssignmentIntent, AssignmentOperation } from './assignment'

/** Lo que el flujo necesita del servicio; se arma desde createShipmentService. */
export interface AssignmentApi {
  request: (intent: AssignmentIntent, signal: AbortSignal) => Promise<{ status: number; data: unknown }>
  read: (operationId: string, signal: AbortSignal) => Promise<unknown>
  verify: (operation: AssignmentOperation, signal: AbortSignal) => Promise<boolean>
}

export type AssignmentView =
  | { phase: 'idle' }
  | { phase: 'requesting' }
  /** Solicitado: el servicio aceptó (202) pero NO hay asignación todavía. */
  | { phase: 'requested'; operation: AssignmentOperation }
  /** Demorado: venció la espera visual; el seguimiento se conserva y no se crea otra solicitud. */
  | { phase: 'delayed'; operation: AssignmentOperation; checkFailed?: boolean }
  | { phase: 'confirmed'; operation: AssignmentOperation }
  | { phase: 'rejected'; operation: AssignmentOperation }
  /** Resultado del POST desconocido: reintentar solo con la misma clave de idempotencia. */
  | { phase: 'uncertain' }
  | { phase: 'failed'; error: unknown }

export type Emit = (view: AssignmentView) => void
export type Wait = (ms: number, signal: AbortSignal) => Promise<void>

/** Backoff creciente; la espera visual total queda acotada. */
export const POLL_DELAYS_MS: readonly number[] = [1000, 2000, 4000, 8000, 10000]
export const VISUAL_TIMEOUT_MS = 45_000

export const sleep: Wait = (ms, signal) =>
  new Promise<void>((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer)
      reject(new DOMException('Espera cancelada.', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', cancel)
      resolve()
    }, ms)
    if (signal.aborted) {
      cancel()
      return
    }
    signal.addEventListener('abort', cancel, { once: true })
  })

/** Estado de interfaz de una operación ya validada. APPLIED es lo único que confirma. */
export function viewFor(operation: AssignmentOperation): AssignmentView {
  if (operation.status === 'PENDING') return { phase: 'requested', operation }
  if (operation.status === 'APPLIED') return { phase: 'confirmed', operation }
  return { phase: 'rejected', operation }
}

function sameTarget(operation: AssignmentOperation, reference: AssignmentOperation): boolean {
  return (
    operation.operationId === reference.operationId &&
    operation.envioId === reference.envioId &&
    operation.repartidorId === reference.repartidorId
  )
}

/** Un 5xx puede provenir del proxy después del commit: conservar la clave original. */
function failureView(cause: unknown): AssignmentView {
  if (cause instanceof RequestError && (cause.code === 'network' || cause.code === 'response')) return { phase: 'uncertain' }
  if (cause instanceof HttpError && cause.status >= 500) return { phase: 'uncertain' }
  return { phase: 'failed', error: cause }
}

/**
 * Envía la solicitud y, si fue aceptada con 202, sigue la operación.
 * Un 202 jamás se muestra como asignación exitosa: solo APPLIED de la operación consultada confirma.
 */
export async function runAssignment(
  api: AssignmentApi,
  intent: AssignmentIntent,
  signal: AbortSignal,
  emit: Emit,
  wait: Wait = sleep,
): Promise<void> {
  emit({ phase: 'requesting' })
  let reply: { status: number; data: unknown }
  try {
    reply = await api.request(intent, signal)
  } catch (cause) {
    if (signal.aborted) return
    emit(failureView(cause))
    return
  }
  if (signal.aborted) return
  if (reply.status !== 202) {
    emit({ phase: 'uncertain' })
    return
  }
  const operation = parseOperation(reply.data)
  if (!operation) {
    emit({ phase: 'uncertain' })
    return
  }
  if (operation.envioId !== intent.envioId || operation.repartidorId !== intent.repartidorId) {
    emit({ phase: 'failed', error: new RequestError('response') })
    return
  }
  emit({ phase: 'requested', operation })
  await trackOperation(api, operation, signal, emit, wait)
}

/**
 * Sondeo acotado con backoff. Al agotar la espera visual queda "demorado" y se detiene:
 * no crea otro POST. Cancelar la señal (logout, desmontaje) corta todo y descarta lo tardío.
 */
export async function trackOperation(
  api: AssignmentApi,
  initial: AssignmentOperation,
  signal: AbortSignal,
  emit: Emit,
  wait: Wait = sleep,
): Promise<void> {
  let last = initial
  let elapsed = 0
  let step = 0
  while (!signal.aborted) {
    const delay = POLL_DELAYS_MS[Math.min(step, POLL_DELAYS_MS.length - 1)] ?? 10_000
    if (elapsed + delay > VISUAL_TIMEOUT_MS) {
      emit({ phase: 'delayed', operation: last })
      return
    }
    try {
      await wait(delay, signal)
    } catch {
      return
    }
    elapsed += delay
    step += 1
    try {
      const operation = parseOperation(await api.read(initial.operationId, signal))
      if (signal.aborted) return
      if (!operation || !sameTarget(operation, initial)) {
        emit({ phase: 'failed', error: new RequestError('response') })
        return
      }
      last = operation
      const next = viewFor(operation)
      if (next.phase === 'confirmed') {
        const matches = await api.verify(operation, signal)
        if (signal.aborted) return
        if (!matches) { emit({ phase: 'failed', error: new RequestError('response') }); return }
      }
      emit(next)
      if (next.phase !== 'requested') return
    } catch (cause) {
      if (signal.aborted) return
      // 401/403: el cliente de sesión ya cierra la sesión; no se sigue sondeando.
      if (cause instanceof HttpError && (cause.status === 401 || cause.status === 403)) return
      if (cause instanceof HttpError && cause.status === 404) {
        emit({ phase: 'failed', error: cause })
        return
      }
      // Falla transitoria (red, 5xx): se sigue dentro del presupuesto de espera.
    }
  }
}

/** Consulta manual desde "demorado": una sola lectura, sin sondeo nuevo ni otro POST. */
export async function refreshOperation(
  api: AssignmentApi,
  known: AssignmentOperation,
  signal: AbortSignal,
  emit: Emit,
): Promise<void> {
  try {
    const operation = parseOperation(await api.read(known.operationId, signal))
    if (signal.aborted) return
    if (!operation || !sameTarget(operation, known)) {
      emit({ phase: 'failed', error: new RequestError('response') })
      return
    }
    const next = viewFor(operation)
    if (next.phase === 'confirmed') {
      const matches = await api.verify(operation, signal)
      if (signal.aborted) return
      if (!matches) { emit({ phase: 'failed', error: new RequestError('response') }); return }
    }
    emit(next.phase === 'requested' ? { phase: 'delayed', operation } : next)
  } catch (cause) {
    if (signal.aborted) return
    if (cause instanceof HttpError && (cause.status === 401 || cause.status === 403)) return
    emit({ phase: 'delayed', operation: known, checkFailed: true })
  }
}
