import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { PageHeader } from '../../shared/components/PageHeader'
import { Button } from '../../shared/components/Button'
import { RequestErrorNotice } from '../../shared/components/RequestErrorNotice'
import { useAuth } from '../auth/session/authContext'
import { normalizeCourierDraft, uuidValid } from './contract'
import { isUnconfirmedWrite } from './operations'
import { useCourierService } from './useCourierService'
import type { CourierService } from './services/courierService'
import type { EstadoRepartidor, Repartidor } from './types'
import { CourierDetail } from './CourierDetail'
import styles from './CouriersPage.module.css'

/** Integra el alcance Courier de JMatiasF conservando módulos, router y sesión de la base. */
export function CouriersPage({ service: provided }: { service?: CourierService }) {
  const defaultService = useCourierService()
  const service = provided ?? defaultService
  const { state } = useAuth()
  const admin = state.user?.roles.includes('ADMIN') ?? false
  const allowed = admin || (state.user?.roles.includes('REPARTIDOR') ?? false)
  const [items, setItems] = useState<Repartidor[]>([])
  const [filter, setFilter] = useState<EstadoRepartidor | ''>('')
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(admin)
  const [listError, setListError] = useState<unknown>(null)
  const [writeError, setWriteError] = useState<unknown>(null)
  const [validation, setValidation] = useState('')
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const creating = useRef<AbortController | null>(null)
  useEffect(() => () => { creating.current?.abort() }, [])
  useEffect(() => {
    if (!admin) return
    const controller = new AbortController()
    service.list(filter || undefined, controller.signal).then((rows) => { if (!controller.signal.aborted) setItems(rows) })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setListError(cause) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [service, admin, filter, revision])
  const refresh = () => { setLoading(true); setListError(null); setItems([]); setRevision((value) => value + 1) }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!admin || creating.current || uncertain) return
    const form = event.currentTarget
    const data = new FormData(form)
    let draft
    try { draft = normalizeCourierDraft({ nombre: String(data.get('nombre') ?? ''), tipoVehiculo: String(data.get('tipoVehiculo') ?? '') }) }
    catch (cause) { setValidation(cause instanceof Error ? cause.message : 'Revisá los datos.'); return }
    const controller = new AbortController()
    creating.current = controller
    setBusy(true); setWriteError(null); setValidation('')
    try {
      const row = await service.create(draft, controller.signal)
      if (!controller.signal.aborted) { form.reset(); setSelected(row.id); refresh() }
    } catch (cause) {
      if (!controller.signal.aborted) { setWriteError(cause); if (isUnconfirmedWrite(cause)) { setUncertain(true); refresh() } }
    } finally {
      if (creating.current === controller) creating.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const id = String(new FormData(event.currentTarget).get('id') ?? '').trim()
    if (!uuidValid(id)) { setValidation('Ingresá un UUID de ficha Courier válido.'); return }
    setValidation(''); setSelected(id)
  }
  if (!allowed) return <section><h1>Acceso no permitido</h1><p>Tu perfil no puede consultar Courier.</p></section>
  return <div className={styles.workspace}>
    <PageHeader title="Repartidores" description={admin ? 'Gestioná el directorio y los estados operativos.' : 'Consultá tu ficha vinculada de repartidor.'} />
    {validation && <p role="alert">{validation}</p>}
    {admin && <section className={styles.card} aria-labelledby="courier-list-title">
      <h2 id="courier-list-title">Directorio de repartidores</h2>
      <div className={styles.toolbar}>
        <label>Filtrar repartidores por estado<select value={filter} onChange={(event) => { setLoading(true); setListError(null); setItems([]); setFilter(event.target.value as EstadoRepartidor | '') }}><option value="">Todos</option><option>ACTIVO</option><option>INACTIVO</option></select></label>
        <Button variant="secondary" disabled={loading} onClick={refresh}>Actualizar directorio</Button>
      </div>
      {loading && <p role="status">Cargando repartidores…</p>}
      {listError !== null && <RequestErrorNotice error={listError} />}
      {!loading && listError === null && items.length === 0 && <p>No hay repartidores para el filtro seleccionado.</p>}
      {!loading && listError === null && items.length > 0 && <div className={styles.tableScroll}><table>
        <caption>Repartidores del directorio</caption><thead><tr><th>Nombre</th><th>Vehículo</th><th>Estado</th><th>Ficha</th></tr></thead>
        <tbody>{items.map((row) => <tr key={row.id}><td>{row.nombre}</td><td>{row.tipoVehiculo}</td><td><span className={styles.courierStatus} data-active={row.estado === 'ACTIVO'}>{row.estado}</span></td><td><Button variant="secondary" onClick={() => setSelected(row.id)}>Ver {row.nombre}</Button></td></tr>)}</tbody>
      </table></div>}
    </section>}
    <section className={styles.card} aria-labelledby="courier-lookup-title">
      <h2 id="courier-lookup-title">{admin ? 'Consultar ficha por UUID' : 'Mi recurso de repartidor'}</h2>
      <form onSubmit={lookup} className={styles.toolbar}><label>UUID de la ficha Courier<input name="id" required /></label><Button type="submit">Consultar ficha</Button></form>
      <p>La pertenencia se verifica por identidad en el servicio. Si no conocés tu UUID de dominio, solicitáselo al administrador.</p>
    </section>
    {selected && <CourierDetail key={selected} id={selected} service={service} onChanged={refresh} />}
    {admin && <section className={styles.card} aria-labelledby="courier-create-title">
      <h2 id="courier-create-title">Alta de repartidor</h2>
      <p>El alta crea una ficha ACTIVO; vincularla a una cuenta pertenece al flujo de administración.</p>
      {writeError !== null && <RequestErrorNotice error={writeError} />}
      {uncertain && <div role="alert"><p>El alta pudo haberse realizado. Revisá el directorio antes de volver a enviar POST.</p><Button variant="secondary" onClick={refresh}>Consultar directorio</Button><Button variant="secondary" onClick={() => { setUncertain(false); setWriteError(null) }}>Ya concilié la operación</Button></div>}
      <form onSubmit={create} className={styles.form} aria-busy={busy}><fieldset disabled={busy || uncertain}>
        <legend>Datos del nuevo repartidor</legend><label>Nombre del nuevo repartidor<input name="nombre" required maxLength={255} /></label><label>Vehículo del nuevo repartidor<input name="tipoVehiculo" required maxLength={255} /></label>
        <Button type="submit">{busy ? 'Creando y verificando…' : 'Crear repartidor'}</Button>
      </fieldset></form>
    </section>}
  </div>
}
