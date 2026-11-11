import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../shared/components/Button'
import { RequestErrorNotice } from '../../shared/components/RequestErrorNotice'
import { useAuth } from '../auth/session/authContext'
import { Allowed } from '../auth/session/RequireRole'
import { UI_ROLES } from '../auth/permissions'
import { PageHeader } from '../../shared/components/PageHeader'
import { ShipmentStatus } from './ShipmentStatus'
import { ShipmentCreate } from './ShipmentCreate'
import { ShipmentDetail } from './ShipmentDetail'
import type { ShipmentSelection } from './ShipmentDetail'
import { useShipmentService } from './useShipmentService'
import type { ShipmentService } from './services/shipmentService'
import { ESTADOS_ENVIO } from './types'
import type { Envio, EstadoEnvio } from './types'
import { isUuid } from './validation'
import styles from './ShipmentsPage.module.css'

/** Espacio de envíos ligado a la sesión: lecturas cancelables y actualizaciones confirmadas. */
export function ShipmentsPage({ service: provided }: { service?: ShipmentService }) {
  const defaultService = useShipmentService()
  const service = provided ?? defaultService
  const { state } = useAuth()
  const [items, setItems] = useState<Envio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [validation, setValidation] = useState('')
  const [filter, setFilter] = useState<EstadoEnvio | ''>('')
  const [selection, setSelection] = useState<ShipmentSelection | null>(null)
  const [revision, setRevision] = useState(0)
  const [detailRevision, setDetailRevision] = useState(0)
  const [notice, setNotice] = useState('')
  const refresh = () => { setLoading(true); setError(null); setItems([]); setRevision((value) => value + 1) }
  const refreshAll = () => { refresh(); setDetailRevision((value) => value + 1) }
  useEffect(() => {
    const controller = new AbortController()
    service.list(filter || undefined, controller.signal).then((result) => {
      if (!controller.signal.aborted) setItems(result)
    }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [service, filter, revision])

  function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const kind = form.get('kind') === 'id' ? 'id' : 'tracking'
    const value = String(form.get('query') ?? '').trim()
    if (!value || (kind === 'id' && !isUuid(value))) { setValidation('Ingresá un UUID válido o un código de tracking no vacío.'); return }
    setValidation(''); setSelection({ kind, value })
  }
  return <div className={styles.workspace}>
    <PageHeader
      title="Envíos"
      description={state.user?.roles.includes('REPARTIDOR') ? 'Panel del repartidor: envíos asignados a tu identidad.' : 'Consultá, seguí y gestioná tus envíos.'}
      actions={<Allowed roles={UI_ROLES.createShipment}><a className={styles.createLink} href="#nuevo-envio">Nuevo envío</a></Allowed>}
    />
    {notice && <p role="status">{notice}</p>}
    <section className={styles.card} aria-labelledby="list-title">
      <div className={styles.sectionHeader}>
        <h2 id="list-title">Listado de envíos</h2>
        <Button variant="secondary" onClick={refresh} disabled={loading}>Actualizar listado</Button>
      </div>
      <div className={styles.listControls}>
        <label>Filtrar por estado<select value={filter} onChange={(event) => { setLoading(true); setError(null); setItems([]); setFilter(event.target.value as EstadoEnvio | '') }}><option value="">Todos</option>{ESTADOS_ENVIO.map((estado) => <option key={estado}>{estado}</option>)}</select></label>
        <form onSubmit={lookup} className={styles.lookup}>
          <label>Buscar por<select name="kind"><option value="tracking">Tracking</option><option value="id">UUID</option></select></label>
          <label className={styles.query}>Código o UUID<input name="query" required /></label>
          <Button type="submit">Consultar envío</Button>
        </form>
      </div>
      {validation && <p role="alert">{validation}</p>}
      {loading && <p className={styles.listMessage} role="status">Cargando envíos…</p>}
      {error !== null && <RequestErrorNotice error={error} />}
      {!loading && !error && items.length === 0 && <p className={styles.listMessage}>No hay envíos visibles para el filtro seleccionado.</p>}
      {!loading && !error && items.length > 0 && (
        <div className={styles.tableScroll} role="region" aria-label="Tabla de envíos" tabIndex={0}>
          <table aria-labelledby="list-title">
            <thead><tr><th scope="col">Tracking</th><th scope="col">Recorrido</th><th scope="col">Estado</th><th scope="col">Detalle</th></tr></thead>
            <tbody>
              {items.map((envio) => (
                <tr key={envio.id}>
                  <td><strong>{envio.codigoSeguimiento}</strong><small>{envio.cliente.nombre}</small></td>
                  <td>{envio.origen.ciudad} → {envio.destino.ciudad}</td>
                  <td><ShipmentStatus status={envio.estado} /></td>
                  <td><Button variant="secondary" aria-label={`Ver ${envio.codigoSeguimiento}`} onClick={() => setSelection({ kind: 'id', value: envio.id })}>Ver</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
    {selection && <ShipmentDetail key={`${selection.kind}:${selection.value}:${detailRevision}`} service={service} selection={selection} onChanged={refreshAll} onListChanged={refresh} />}
    <Allowed roles={UI_ROLES.createShipment}><ShipmentCreate service={service} onRefresh={refresh} onCreated={(envio) => {
      setNotice(`Alta confirmada: ${envio.codigoSeguimiento}.`)
      setSelection({ kind: 'id', value: envio.id }); refresh()
    }} /></Allowed>
  </div>
}
