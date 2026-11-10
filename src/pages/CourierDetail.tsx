import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { courierApi } from '../api/services'
import { useAuth } from '../auth/AuthProvider'
import { isCurrentGeneration, sessionGeneration } from '../auth/session'
import { readableError } from '../api/errors'
import { useNotify } from '../components/Notifications'
import { Badge, CopyText, ErrorPanel, Loading, PageTitle, Section } from '../components/UI'
import { normalizeCourierDraft } from '../features/courier/contract'
import { canListOrMutateCouriers } from '../features/courier/contract'
import { changeCourierStateConfirmed, isUnconfirmedWrite, updateCourierConfirmed } from '../features/courier/operations'
import { dateText, uuidValid } from '../utils/format'
import type { Availability, Courier, CourierStatus } from '../types'

type PendingWrite =
  | { kind: 'update'; nombre: string; tipoVehiculo: string }
  | { kind: 'state'; estado: CourierStatus }

function matchesPending(value: Courier, pending: PendingWrite): boolean {
  return pending.kind === 'state'
    ? value.estado === pending.estado
    : value.nombre === pending.nombre && value.tipoVehiculo === pending.tipoVehiculo
}

export function CourierDetail() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const admin = canListOrMutateCouriers(user?.roles || [])
  const notify = useNotify()
  const [item, setItem] = useState<Courier | null>(null)
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [error, setError] = useState('')
  const [availabilityError, setAvailabilityError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [pendingWrite, setPendingWrite] = useState<PendingWrite | null>(null)
  const [reconciled, setReconciled] = useState(false)
  const readSequence = useRef(0)
  const availabilitySequence = useRef(0)
  const activeResourceId = useRef(id)
  activeResourceId.current = id
  const stillViewing = (generation: number, resourceId: string) =>
    isCurrentGeneration(generation) && activeResourceId.current === resourceId

  useEffect(() => {
    const sequence = ++readSequence.current
    const generation = sessionGeneration()
    setItem(null)
    setAvailability(null)
    setError('')
    setPendingWrite(null)
    setReconciled(false)
    setLoading(true)
    setBusy(false)
    if (!uuidValid(id)) {
      setError('El identificador de Courier no tiene formato UUID válido.')
      setLoading(false)
      return () => { readSequence.current++ }
    }
    courierApi.one(id).then(data => {
      if (sequence === readSequence.current && isCurrentGeneration(generation)) setItem(data)
    }).catch(e => {
      if (sequence === readSequence.current && isCurrentGeneration(generation)) setError(readableError(e))
    }).finally(() => {
      if (sequence === readSequence.current && isCurrentGeneration(generation)) setLoading(false)
    })
    return () => { readSequence.current++; availabilitySequence.current++ }
  }, [id, refresh])

  async function checkAvailability() {
    if (busy || !item) return
    const seq = ++availabilitySequence.current
    const generation = sessionGeneration()
    setBusy(true)
    setAvailability(null)
    setAvailabilityError('')
    try {
      const checked = await courierApi.availability(id)
      if (seq === availabilitySequence.current && stillViewing(generation, id)) setAvailability(checked)
    } catch (e) {
      if (seq === availabilitySequence.current && stillViewing(generation, id)) setAvailabilityError(readableError(e))
    } finally {
      if (seq === availabilitySequence.current && stillViewing(generation, id)) setBusy(false)
    }
  }

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!admin || !item || busy || pendingWrite) return
    const form = new FormData(event.currentTarget)
    let draft
    try {
      draft = normalizeCourierDraft({ nombre: String(form.get('nombre') || ''), tipoVehiculo: String(form.get('tipoVehiculo') || '') })
    } catch (e) { setError(readableError(e)); return }
    const generation = sessionGeneration()
    setBusy(true)
    setError('')
    try {
      const confirmed = await updateCourierConfirmed(courierApi, id, draft)
      if (!stillViewing(generation, id)) return
      setItem(confirmed)
      setAvailability(null)
      notify.success('Los datos coinciden con el recurso persistido.')
    } catch (e) {
      if (!stillViewing(generation, id)) return
      setError(readableError(e))
      if (isUnconfirmedWrite(e)) { setPendingWrite({kind:'update', ...draft}); setReconciled(false) }
    } finally {
      if (stillViewing(generation, id)) setBusy(false)
    }
  }

  async function setStatus(estado: CourierStatus) {
    if (!admin || !item || busy || pendingWrite || item.estado === estado) return
    const generation = sessionGeneration()
    setBusy(true)
    setError('')
    try {
      const confirmed = await changeCourierStateConfirmed(courierApi, id, estado)
      if (!stillViewing(generation, id)) return
      setItem(confirmed)
      setAvailability(null)
      notify.success('Estado confirmado mediante GET a Courier.')
    } catch (e) {
      if (!stillViewing(generation, id)) return
      setError(readableError(e))
      if (isUnconfirmedWrite(e)) { setPendingWrite({kind:'state',estado}); setReconciled(false) }
    } finally {
      if (stillViewing(generation, id)) setBusy(false)
    }
  }

  async function reconcile() {
    if (!pendingWrite || busy) return
    const generation = sessionGeneration()
    setBusy(true)
    setReconciled(false)
    try {
      const persisted = await courierApi.one(id)
      if (!stillViewing(generation, id)) return
      setItem(persisted)
      setAvailability(null)
      setReconciled(true)
      if (matchesPending(persisted,pendingWrite)) {
        setPendingWrite(null)
        setError('')
        notify.success('Se verificó que la operación está persistida.')
      } else {
        setError('El estado persistido NO coincide con el cambio solicitado. Decidí si necesitás volver a intentarlo.')
      }
    } catch (e) {
      if (stillViewing(generation, id)) setError(readableError(e))
    } finally {
      if (stillViewing(generation, id)) setBusy(false)
    }
  }

  return <>
    <PageTitle
      eyebrow="COURIER / DETALLE"
      title={admin ? 'Ficha del repartidor' : 'Mi ficha Courier'}
      description={admin ? 'Consulta y operaciones administrativas sobre el recurso persistido.' : 'Solo lectura sobre tu recurso vinculado. Courier valida la pertenencia en el backend.'}
      actions={<div className="button-row">
        <Link className="btn btn-outline" to="/courier">← Volver</Link>
        <button type="button" className="btn btn-outline" disabled={busy || loading || !!pendingWrite} onClick={() => setRefresh(x => x + 1)}>↻ Volver a consultar</button>
      </div>}
    />
    {loading ? <Loading label="Consultando Courier…" />
      : error && !item ? <ErrorPanel message={error} onRetry={() => setRefresh(x => x + 1)} />
        : item && <>
          <div className="detail-header panel"><div><div className="eyebrow">REPARTIDOR</div><h2>{item.nombre}</h2><CopyText text={item.id} /></div><Badge value={item.estado} /></div>
          <div className="two-col">
            <Section title="Datos del recurso"><div className="detail-list">
              <div><span>Vehículo</span><strong>{item.tipoVehiculo}</strong></div>
              <div><span>Creado</span><strong>{dateText(item.createdAt)}</strong></div>
              <div><span>Última actualización</span><strong>{dateText(item.updatedAt)}</strong></div>
            </div></Section>
            <Section title="Disponibilidad operativa" description="Disponible equivale a ACTIVO; no es reserva ni garantía de capacidad.">
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => void checkAvailability()}>◎ Consultar disponibilidad</button>
              {availabilityError && <div role="alert" className="inline-error">{availabilityError}</div>}
              {availability && <div className="availability-result" role="status">
                <Badge value={availability.estado} />
                <strong>{availability.disponible ? 'Disponible' : 'No disponible'}</strong>
                <p>Dato observado en la última consulta. Puede cambiar.</p>
              </div>}
            </Section>
          </div>
          {admin && <div className="two-col">
            <Section title="Editar repartidor" description="PUT reemplaza únicamente nombre y tipoVehiculo; no cambia estado ni identidad.">
              <form key={`${item.id}:${item.updatedAt}`} className="form-stacked" onSubmit={e => void update(e)}>
                <label>Nombre<input name="nombre" required maxLength={255} defaultValue={item.nombre} disabled={busy || !!pendingWrite} /></label>
                <label>Tipo de vehículo<input name="tipoVehiculo" required maxLength={255} defaultValue={item.tipoVehiculo} disabled={busy || !!pendingWrite} /></label>
                <button className="btn btn-primary" disabled={busy || !!pendingWrite}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>
              </form>
            </Section>
            <Section title="Estado del repartidor" description="PATCH /estado. No se elimina información.">
              <p className="muted">Estado persistido: <Badge value={item.estado} /></p>
              <div className="button-row courier-actions">
                <button type="button" className="btn btn-primary" disabled={busy || !!pendingWrite || item.estado === 'ACTIVO'} onClick={() => void setStatus('ACTIVO')}>Activar</button>
                <button type="button" className="btn btn-danger-outline" disabled={busy || !!pendingWrite || item.estado === 'INACTIVO'} onClick={() => void setStatus('INACTIVO')}>Desactivar</button>
              </div>
            </Section>
          </div>}
          {error && <div className="inline-error" role="alert">{error}</div>}
          {pendingWrite && <div className="warning-box courier-reconcile" role="status">
            <strong>Escritura sin confirmación definitiva.</strong>
            <p>No vuelvas a enviar automáticamente PUT/PATCH. Primero consultá el recurso persistido.</p>
            <div className="button-row courier-actions">
              <button className="btn btn-outline" disabled={busy} type="button" onClick={() => void reconcile()}>Verificar recurso persistido</button>
              {reconciled && <button className="btn btn-outline" disabled={busy} type="button" onClick={() => { setPendingWrite(null); setReconciled(false); setError('') }}>Cerrar incidencia tras verificar</button>}
            </div>
          </div>}
        </>}
  </>
}
