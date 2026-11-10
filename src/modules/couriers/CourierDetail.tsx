import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../shared/components/Button'
import { RequestErrorNotice } from '../../shared/components/RequestErrorNotice'
import { useAuth } from '../auth/session/authContext'
import { normalizeCourierDraft } from './contract'
import { isUnconfirmedWrite } from './operations'
import type { CourierService } from './services/courierService'
import type { Disponibilidad, EstadoRepartidor, Repartidor, RepartidorRequest } from './types'
import styles from './CouriersPage.module.css'

type Pending = { kind: 'edit'; draft: RepartidorRequest } | { kind: 'state'; estado: EstadoRepartidor }

/** Adapta la ficha de JMatiasF a la sesión compartida y conserva su reconciliación por GET. */
export function CourierDetail({ id, service, onChanged }: { id: string; service: CourierService; onChanged: () => void }) {
  const { state } = useAuth()
  const admin = state.user?.roles.includes('ADMIN') ?? false
  const [item, setItem] = useState<Repartidor | null>(null)
  const [availability, setAvailability] = useState<Disponibilidad | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [validation, setValidation] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [pendingWrite, setPendingWrite] = useState<Pending | null>(null)
  const [reconciled, setReconciled] = useState(false)
  const operation = useRef<AbortController | null>(null)
  useEffect(() => () => { operation.current?.abort() }, [])
  useEffect(() => {
    const controller = new AbortController()
    service.detail(id, controller.signal).then((row) => { if (!controller.signal.aborted) setItem(row) })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id, service, revision])

  async function execute(change?: Pending, reconcile = false) {
    if (operation.current || loading || !item) return
    if (change && (!admin || pendingWrite)) return
    const controller = new AbortController()
    operation.current = controller
    setBusy(true); setError(null); setValidation(''); setNotice('')
    try {
      if (reconcile && pendingWrite) {
        const row = await service.detail(id, controller.signal)
        if (controller.signal.aborted) return
        setItem(row); setAvailability(null); setReconciled(true)
        const matches = pendingWrite.kind === 'state' ? row.estado === pendingWrite.estado
          : row.nombre === pendingWrite.draft.nombre && row.tipoVehiculo === pendingWrite.draft.tipoVehiculo
        if (matches) { setPendingWrite(null); setNotice('Operación confirmada mediante lectura del recurso.') }
        else setNotice('El recurso consultado no coincide con el cambio solicitado. Decidí el próximo paso después de verificarlo.')
      } else if (change) {
        const row = change.kind === 'edit' ? await service.update(id, change.draft, controller.signal)
          : await service.changeState(id, change.estado, controller.signal)
        if (controller.signal.aborted) return
        setItem(row); setAvailability(null); setNotice('Cambio confirmado mediante lectura del recurso.'); onChanged()
      } else {
        const checked = await service.availability(id, controller.signal)
        if (!controller.signal.aborted) setAvailability(checked)
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause)
        if (change && isUnconfirmedWrite(cause)) { setPendingWrite(change); setReconciled(false) }
      }
    } finally {
      if (operation.current === controller) operation.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (operation.current || pendingWrite) return
    const form = new FormData(event.currentTarget)
    let draft
    try { draft = normalizeCourierDraft({ nombre: String(form.get('nombre') ?? ''), tipoVehiculo: String(form.get('tipoVehiculo') ?? '') }) }
    catch (cause) { setValidation(cause instanceof Error ? cause.message : 'Revisá los datos.'); return }
    void execute({ kind: 'edit', draft })
  }
  return <section className={styles.card} aria-labelledby="courier-detail-title">
    <h2 id="courier-detail-title">{admin ? 'Ficha del repartidor' : 'Mi ficha Courier'}</h2>
    {loading && <p role="status">Cargando ficha…</p>}
    {error !== null && <RequestErrorNotice error={error} />}
    {validation && <p role="alert">{validation}</p>}
    {notice && <p role="status">{notice}</p>}
    <Button variant="secondary" disabled={busy || loading || !!pendingWrite} onClick={() => { setLoading(true); setItem(null); setAvailability(null); setError(null); setRevision((value) => value + 1) }}>Volver a consultar</Button>
    {item && <>
      <dl className={styles.details}>
        <dt>UUID</dt><dd>{item.id}</dd><dt>Nombre</dt><dd>{item.nombre}</dd><dt>Vehículo</dt><dd>{item.tipoVehiculo}</dd><dt>Estado</dt><dd>{item.estado}</dd>
        <dt>Última actualización</dt><dd><time dateTime={item.updatedAt}>{item.updatedAt}</time></dd>
      </dl>
      <Button disabled={busy} onClick={() => void execute()}>Consultar disponibilidad</Button>
      {availability && <p role="status">{availability.disponible ? 'Disponible' : 'No disponible'} ({availability.estado}). Es una observación; no reserva capacidad.</p>}
      {admin && <>
        <form key={`${item.id}:${item.updatedAt}`} onSubmit={update} className={styles.form}>
          <fieldset disabled={busy || !!pendingWrite}>
            <legend>Editar repartidor</legend>
            <label>Nombre de la ficha<input name="nombre" defaultValue={item.nombre} required maxLength={255} /></label>
            <label>Vehículo de la ficha<input name="tipoVehiculo" defaultValue={item.tipoVehiculo} required maxLength={255} /></label>
            <Button type="submit">Guardar cambios</Button>
          </fieldset>
        </form>
        <div className={styles.toolbar}>
          <Button disabled={busy || !!pendingWrite || item.estado === 'ACTIVO'} onClick={() => void execute({ kind: 'state', estado: 'ACTIVO' })}>Activar</Button>
          <Button variant="secondary" disabled={busy || !!pendingWrite || item.estado === 'INACTIVO'} onClick={() => void execute({ kind: 'state', estado: 'INACTIVO' })}>Desactivar</Button>
        </div>
      </>}
      {pendingWrite && <div role="alert">
        <p>Escritura sin confirmación definitiva. Consultá el recurso antes de decidir otro cambio; no se repite automáticamente.</p>
        <Button disabled={busy} onClick={() => void execute(undefined, true)}>Verificar recurso persistido</Button>
        {reconciled && <Button variant="secondary" disabled={busy} onClick={() => { setPendingWrite(null); setReconciled(false); setError(null) }}>Ya verifiqué el estado; habilitar cambios</Button>}
      </div>}
    </>}
  </section>
}
