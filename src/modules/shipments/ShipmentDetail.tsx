import { useEffect, useRef, useState } from 'react'
import { Button } from '../../shared/components/Button'
import { RequestErrorNotice } from '../../shared/components/RequestErrorNotice'
import { RequestError } from '../../shared/http/httpError'
import { USE_MOCKS } from '../../shared/config/env'
import { useAuth } from '../auth/session/authContext'
import { DEMO_COURIER_ID } from './mocks/shipmentServer'
import { isUuid } from './validation'
import type { Envio, HistorialEvento } from './types'
import type { ShipmentService } from './services/shipmentService'
import styles from './ShipmentsPage.module.css'

export interface ShipmentSelection { kind: 'id' | 'tracking'; value: string }
type Action = 'assign' | 'advance' | 'cancel'

/** Detalle confirmado y comandos explícitos, sin cambios optimistas ni reintentos automáticos. */
export function ShipmentDetail({ service, selection, onChanged }: { service: ShipmentService; selection: ShipmentSelection; onChanged: () => void }) {
  const { state } = useAuth()
  const [data, setData] = useState<{ envio: Envio; history: HistorialEvento[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [validation, setValidation] = useState('')
  const [courier, setCourier] = useState('')
  const [action, setAction] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => { pending.current?.abort() }, [])
  useEffect(() => {
    const controller = new AbortController()
    const read = async () => {
      try {
        const envio = await (selection.kind === 'id' ? service.detail(selection.value, controller.signal) : service.tracking(selection.value, controller.signal))
        const history = await service.history(envio.id, controller.signal)
        if (!controller.signal.aborted) { setData({ envio, history }); setUncertain(false) }
      } catch (cause) { if (!controller.signal.aborted) setError(cause) }
      finally { if (!controller.signal.aborted) setLoading(false) }
    }
    void read()
    return () => controller.abort()
  }, [service, selection.kind, selection.value])

  async function mutate() {
    if (!action || !data || pending.current || uncertain) return
    if (action === 'assign' && !isUuid(courier.trim())) { setValidation('Ingresá un UUID de repartidor válido.'); return }
    const controller = new AbortController()
    pending.current = controller
    setBusy(true); setError(null); setValidation('')
    try {
      if (action === 'assign') await service.assign(data.envio.id, courier.trim(), controller.signal)
      else if (action === 'cancel') await service.cancel(data.envio.id, controller.signal)
      else await service.advance(data.envio.id, data.envio.estado === 'PENDIENTE' ? 'EN_RUTA' : 'ENTREGADO', controller.signal)
      if (!controller.signal.aborted) { setAction(null); onChanged() }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause)
        if (cause instanceof RequestError && ['network', 'response'].includes(cause.code)) setUncertain(true)
      }
    } finally {
      if (pending.current === controller) pending.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  const admin = state.user?.roles.includes('ADMIN') ?? false
  const repartidor = state.user?.roles.includes('REPARTIDOR') ?? false
  const envio = data?.envio
  return <section className={styles.card} aria-labelledby="detail-title">
    <h2 id="detail-title">Detalle e historial</h2>
    {loading && <p role="status">Cargando detalle…</p>}
    {error !== null && <RequestErrorNotice error={error} />}
    {validation && <p role="alert">{validation}</p>}
    {uncertain && <p role="alert">Resultado no confirmado. Actualizá el detalle y verificá el estado antes de decidir otra operación.</p>}
    <Button variant="secondary" disabled={busy || loading} onClick={onChanged}>Actualizar detalle</Button>
    {envio && <>
      <dl className={styles.details}>
        <dt>UUID</dt><dd>{envio.id}</dd><dt>Tracking</dt><dd>{envio.codigoSeguimiento}</dd>
        <dt>Estado</dt><dd>{envio.estado}</dd><dt>Cliente</dt><dd>{envio.cliente.nombre} ({envio.cliente.email})</dd>
        {admin && <><dt>UUID del cliente</dt><dd>{envio.cliente.id}</dd></>}
        <dt>Repartidor</dt><dd>{envio.repartidorId ?? 'Sin asignar'}</dd>
        <dt>Origen</dt><dd>{envio.origen.calle} {envio.origen.numero}, {envio.origen.ciudad} ({envio.origen.codigoPostal})</dd>
        <dt>Destino</dt><dd>{envio.destino.calle} {envio.destino.numero}, {envio.destino.ciudad} ({envio.destino.codigoPostal})</dd>
        <dt>Medidas</dt><dd>{envio.pesoKg} kg; {envio.anchoCm} × {envio.altoCm} × {envio.largoCm} cm</dd>
      </dl>
      <h3>Historial</h3>
      <ol aria-label="Historial de estados">{data.history.map((event) => <li key={event.id}>{event.estadoAnterior ?? 'Inicio'} → {event.estadoNuevo} — <time dateTime={event.fechaCambio}>{event.fechaCambio}</time></li>)}</ol>
      <p>Las acciones disponibles no sustituyen la autorización y pertenencia verificadas por el servicio.</p>
      <fieldset disabled={busy || uncertain || loading} className={styles.actions}>
        <legend>Acciones del envío</legend>
        {admin && envio.estado === 'PENDIENTE' && <>
          <label>UUID del repartidor<input value={courier} onChange={(event) => setCourier(event.target.value)} /></label>
          {USE_MOCKS && <small>Repartidor de demostración: {DEMO_COURIER_ID}. Verificá su estado en Courier; disponible no significa reservado.</small>}
          <Button onClick={() => setAction('assign')}>Asignar repartidor</Button>
          <Button variant="secondary" onClick={() => setAction('cancel')}>Cancelar envío</Button>
        </>}
        {(admin || repartidor) && (envio.estado === 'EN_RUTA' || (envio.estado === 'PENDIENTE' && envio.repartidorId)) &&
          <Button onClick={() => setAction('advance')}>{envio.estado === 'PENDIENTE' ? 'Pasar a EN_RUTA' : 'Marcar ENTREGADO'}</Button>}
        {action && <div>
          <p>Confirmá la operación sobre {envio.codigoSeguimiento}: {action === 'assign' ? 'asignación' : action === 'cancel' ? 'cancelación' : 'cambio de estado'}.</p>
          <Button onClick={() => void mutate()}>{busy ? 'Procesando…' : 'Confirmar operación'}</Button>{' '}
          <Button variant="secondary" onClick={() => setAction(null)}>Volver sin aplicar</Button>
        </div>}
        {!admin && !repartidor && <p>Tu perfil permite consultar este envío.</p>}
        {['ENTREGADO', 'CANCELADO'].includes(envio.estado) && <p>Estado terminal: no hay transiciones disponibles.</p>}
      </fieldset>
    </>}
  </section>
}
