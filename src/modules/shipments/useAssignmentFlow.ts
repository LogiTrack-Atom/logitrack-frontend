import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/session/authContext'
import type { AssignmentIntent } from './assignment'
import { refreshOperation, runAssignment } from './assignmentFlow'
import type { AssignmentApi, AssignmentView, Emit } from './assignmentFlow'

/**
 * Estado asíncrono de una asignación. Una sola tarea a la vez (evita duplicados),
 * un abort al desmontar o al terminar la sesión, y la misma Idempotency-Key en cada reintento.
 */
export function useAssignmentFlow(api: AssignmentApi, envioId: string, onSettled: () => void) {
  const { state } = useAuth()
  const signedIn = Boolean(state.user)
  const [view, setView] = useState<AssignmentView>({ phase: 'idle' })
  const latest = useRef<AssignmentView>({ phase: 'idle' })
  const running = useRef<AbortController | null>(null)
  const intent = useRef<AssignmentIntent | null>(null)

  // Sesión terminada: aborta sondeos y solicitudes; lo que llegue tarde se descarta.
  useEffect(() => {
    if (!signedIn) {
      running.current?.abort()
      running.current = null
    }
  }, [signedIn])
  useEffect(
    () => () => {
      running.current?.abort()
    },
    [],
  )

  const launch = useCallback(
    (task: (signal: AbortSignal, emit: Emit) => Promise<void>) => {
      const controller = new AbortController()
      running.current = controller
      const emit: Emit = (next) => {
        if (controller.signal.aborted) return
        latest.current = next
        setView(next)
        if (next.phase === 'confirmed' || next.phase === 'rejected') onSettled()
      }
      void task(controller.signal, emit).finally(() => {
        if (running.current === controller) running.current = null
      })
    },
    [onSettled],
  )

  const start = useCallback(
    (repartidorId: string) => {
      if (running.current) return
      const phase = latest.current.phase
      if (phase === 'requesting' || phase === 'requested' || phase === 'delayed' || phase === 'uncertain') return
      const next: AssignmentIntent = { envioId, repartidorId, idempotencyKey: crypto.randomUUID() }
      intent.current = next
      launch((signal, emit) => runAssignment(api, next, signal, emit))
    },
    [api, envioId, launch],
  )

  /** Solo tras un resultado incierto: reutiliza la misma clave, por eso no duplica la solicitud. */
  const retry = useCallback(() => {
    const current = intent.current
    if (running.current || !current || latest.current.phase !== 'uncertain') return
    launch((signal, emit) => runAssignment(api, current, signal, emit))
  }, [api, launch])

  /** Consulta manual de una operación demorada; no crea otra solicitud. */
  const refresh = useCallback(() => {
    const current = latest.current
    if (running.current || current.phase !== 'delayed') return
    const known = current.operation
    launch((signal, emit) => refreshOperation(api, known, signal, emit))
  }, [api, launch])

  const shown: AssignmentView = signedIn ? view : { phase: 'idle' }
  return { view: shown, start, retry, refresh }
}
