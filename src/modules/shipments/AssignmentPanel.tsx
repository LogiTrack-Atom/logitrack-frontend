import { useMemo, useState } from 'react'
import { Button } from '../../shared/components/Button'
import { RequestErrorNotice } from '../../shared/components/RequestErrorNotice'
import type { AssignmentStatus } from './assignment'
import type { AssignmentApi } from './assignmentFlow'
import type { ShipmentService } from './services/shipmentService'
import { useAssignmentFlow } from './useAssignmentFlow'
import { isUuid } from './validation'
import styles from './ShipmentsPage.module.css'

function rejectedText(status: AssignmentStatus): string {
  if (status === 'SUPERSEDED') return 'Reemplazada: el envío cambió antes de llegar el resultado. Esta solicitud no asignó al repartidor.'
  if (status === 'EXPIRED') return 'Vencida: no llegó resultado a tiempo. Esta solicitud no asignó al repartidor.'
  return 'Rechazada: el repartidor no estaba disponible. No se asignó.'
}

/** Asignación asíncrona (solo ADMIN, envío PENDIENTE). Convive con la asignación directa; no la reemplaza. */
export function AssignmentPanel({ service, envioId, onSettled }: { service: ShipmentService; envioId: string; onSettled: () => void }) {
  const api = useMemo<AssignmentApi>(
    () => ({
      request: (intent, signal) => service.requestAssignment(intent.envioId, intent.repartidorId, intent.idempotencyKey, signal),
      read: (operationId, signal) => service.assignmentOperation(operationId, signal),
    }),
    [service],
  )
  const { view, start, retry, refresh } = useAssignmentFlow(api, envioId, onSettled)
  const [courier, setCourier] = useState('')
  const [validation, setValidation] = useState('')
  const locked = ['requesting', 'requested', 'delayed', 'uncertain'].includes(view.phase)

  function submit() {
    const id = courier.trim()
    if (!isUuid(id)) {
      setValidation('Ingresá un UUID de repartidor válido.')
      return
    }
    setValidation('')
    start(id)
  }

  return (
    <section aria-labelledby="async-assign-title">
      <h3 id="async-assign-title">Asignación asíncrona</h3>
      <p>La solicitud se acepta primero y se confirma después. Que el repartidor figure disponible no significa que quede reservado.</p>
      <div className={styles.actions}>
        <label>
          UUID del repartidor
          <input value={courier} disabled={locked} onChange={(event) => setCourier(event.target.value)} />
        </label>
        <Button disabled={locked || view.phase === 'confirmed'} onClick={submit}>
          Solicitar asignación
        </Button>
      </div>
      {validation && <p role="alert">{validation}</p>}
      <div role="status" aria-live="polite">
        {view.phase === 'requesting' && <p>Enviando la solicitud…</p>}
        {view.phase === 'requested' && (
          <p>Solicitado (operación {view.operation.operationId}): todavía no hay asignación. Consultando el resultado…</p>
        )}
        {view.phase === 'delayed' && (
          <>
            <p>
              Demorado: la solicitud sigue pendiente y el repartidor aún no está asignado. Se conserva el seguimiento de la
              operación {view.operation.operationId} y no se crea otra solicitud automáticamente.
            </p>
            {view.checkFailed && <p role="alert">No se pudo consultar ahora. Probá de nuevo en unos segundos.</p>}
            <Button variant="secondary" onClick={refresh}>
              Consultar ahora
            </Button>
          </>
        )}
        {view.phase === 'confirmed' && <p>Confirmado: el repartidor quedó asignado (operación {view.operation.operationId}).</p>}
        {view.phase === 'rejected' && <p role="alert">{rejectedText(view.operation.status)}</p>}
        {view.phase === 'uncertain' && (
          <>
            <p role="alert">
              Resultado no confirmado: no sabemos si el servicio recibió la solicitud. Reintentar reutiliza la misma clave de
              idempotencia, por lo que no duplica la operación.
            </p>
            <Button variant="secondary" onClick={retry}>
              Reintentar con la misma clave
            </Button>
          </>
        )}
        {view.phase === 'failed' && <RequestErrorNotice error={view.error} />}
      </div>
    </section>
  )
}
