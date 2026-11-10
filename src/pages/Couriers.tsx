import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { courierApi } from '../api/services'
import { useAuth } from '../auth/AuthProvider'
import { isCurrentGeneration, sessionGeneration } from '../auth/session'
import { readableError } from '../api/errors'
import { useNotify } from '../components/Notifications'
import { Badge, Empty, ErrorPanel, Loading, PageTitle, Section } from '../components/UI'
import { canListOrMutateCouriers, normalizeCourierDraft } from '../features/courier/contract'
import { createCourierConfirmed, isUnconfirmedWrite } from '../features/courier/operations'
import { dateText, shortId, uuidValid } from '../utils/format'
import type { Courier, CourierStatus } from '../types'

export function Couriers() {
  const { user } = useAuth()
  const admin = canListOrMutateCouriers(user?.roles || [])
  const notify = useNotify()
  const navigate = useNavigate()

  const [items, setItems] = useState<Courier[]>([])
  const [filter, setFilter] = useState<CourierStatus | ''>('')
  const [refresh, setRefresh] = useState(0)
  const [loading, setLoading] = useState(admin)
  const [listError, setListError] = useState('')
  const [createError, setCreateError] = useState('')
  const [busy, setBusy] = useState(false)
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [ownId, setOwnId] = useState('')
  const fetchSequence = useRef(0)

  // Si cambia el filtro o el usuario, una respuesta anterior nunca pisa la nueva lista.
  useEffect(() => {
    const request = ++fetchSequence.current
    if (!admin) {
      setItems([])
      setLoading(false)
      return () => { fetchSequence.current++ }
    }
    const generation = sessionGeneration()
    setLoading(true)
    setListError('')
    setItems([])
    courierApi.list(filter).then(data => {
      if (request === fetchSequence.current && isCurrentGeneration(generation)) setItems(data)
    }).catch(error => {
      if (request === fetchSequence.current && isCurrentGeneration(generation)) setListError(readableError(error))
    }).finally(() => {
      if (request === fetchSequence.current && isCurrentGeneration(generation)) setLoading(false)
    })
    return () => { fetchSequence.current++ }
  }, [admin, filter, refresh])

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!admin || busy || unconfirmed) return
    const form = event.currentTarget
    const data = new FormData(form)
    const generation = sessionGeneration()
    setBusy(true)
    setCreateError('')
    try {
      const draft = normalizeCourierDraft({
        nombre: String(data.get('nombre') || ''),
        tipoVehiculo: String(data.get('tipoVehiculo') || ''),
      })
      const confirmed = await createCourierConfirmed(courierApi, draft)
      if (!isCurrentGeneration(generation)) return
      notify.success('Alta confirmada mediante lectura del recurso persistido.')
      navigate(`/courier/${confirmed.id}`)
    } catch (error) {
      if (!isCurrentGeneration(generation)) return
      setCreateError(readableError(error))
      // No repetir POST tras un corte o una respuesta 202: puede haber creado el registro.
      if (isUnconfirmedWrite(error)) setUnconfirmed(true)
    } finally {
      if (isCurrentGeneration(generation)) setBusy(false)
    }
  }

  return <>
    <PageTitle
      eyebrow="OPERACIONES / COURIER SERVICE"
      title="Repartidores"
      description={admin
        ? 'Listado, altas, edición y estados operativos del servicio Courier.'
        : 'Consultá solamente tu recurso vinculado a la cuenta autenticada.'}
      actions={admin && <button type="button" className="btn btn-outline" disabled={loading} onClick={() => setRefresh(x => x + 1)}>↻ Actualizar listado</button>}
    />
    {!admin ? <Section
      title="Mi recurso de repartidor"
      description="Courier valida en el servidor que el UUID esté asociado a tu usuario JWT. El UUID de tu cuenta no equivale al de tu ficha de repartidor."
    >
      <div className="form-inline">
        <label>UUID de tu ficha Courier
          <input
            value={ownId}
            onChange={event => setOwnId(event.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!uuidValid(ownId)}
          onClick={() => navigate(`/courier/${ownId.trim()}`)}
        >Consultar mi ficha →</button>
      </div>
      <p className="muted courier-note">Si no conocés el UUID de tu repartidor, solicitáselo a un ADMIN. No hay endpoint público para buscarlo desde otra cuenta.</p>
    </Section> : <>
      <div className="two-col asymmetric">
        <Section title="Directorio de repartidores" description="Acceso exclusivo ADMIN. Filtrado realizado por el backend.">
          <div className="filter-row">
            <label className="filter-select">Filtrar por estado
              <select aria-label="Filtrar repartidores por estado" value={filter} onChange={e => setFilter(e.target.value as CourierStatus | '')}>
                <option value="">Todos</option>
                <option value="ACTIVO">Activo</option>
                <option value="INACTIVO">Inactivo</option>
              </select>
            </label>
          </div>
          {loading ? <Loading label="Consultando repartidores…" />
            : listError ? <ErrorPanel message={listError} onRetry={() => setRefresh(x => x + 1)} />
              : items.length === 0 ? <Empty title="Sin repartidores" description="No hay resultados para el estado seleccionado." />
                : <div className="table-wrap"><table>
                  <thead><tr><th>REPARTIDOR</th><th>VEHÍCULO</th><th>ESTADO</th><th>ALTA</th><th>ACCIÓN</th></tr></thead>
                  <tbody>{items.map(item => <tr key={item.id}>
                    <td><strong>{item.nombre}</strong><small>{shortId(item.id)}</small></td>
                    <td>{item.tipoVehiculo}</td>
                    <td><Badge value={item.estado} /></td>
                    <td>{dateText(item.createdAt)}</td>
                    <td><Link className="btn btn-small btn-outline" to={`/courier/${item.id}`}>Ver detalle →</Link></td>
                  </tr>)}</tbody>
                </table></div>}
        </Section>
        <Section title="Alta de repartidor" description="POST crea un recurso ACTIVO. La asociación de usuario se realiza en un flujo administrativo separado.">
          <form className="form-stacked" onSubmit={event => void create(event)}>
            <label>Nombre
              <input name="nombre" placeholder="Nombre y apellido" required maxLength={255} disabled={busy || unconfirmed} />
            </label>
            <label>Tipo de vehículo
              <input name="tipoVehiculo" placeholder="Moto / Auto / Bicicleta" required maxLength={255} disabled={busy || unconfirmed} />
            </label>
            {createError && <div role="alert" className="inline-error">{createError}</div>}
            {unconfirmed && <div className="warning-box" role="status">
              El alta pudo haberse realizado. Consultá el directorio y verificá si el recurso ya existe antes de volver a enviar POST.
              <div className="button-row courier-actions">
                <button type="button" className="btn btn-outline" onClick={() => setRefresh(x => x + 1)}>Consultar directorio</button>
                <button type="button" className="btn btn-outline" onClick={() => { setUnconfirmed(false); setCreateError('') }}>Ya concilié la operación</button>
              </div>
            </div>}
            <button className="btn btn-primary btn-block" disabled={busy || unconfirmed}>
              {busy ? 'Creando y verificando…' : 'Crear repartidor →'}
            </button>
          </form>
        </Section>
      </div>
      <p className="footnote">El contrato Courier no declara DELETE. La desactivación se realiza mediante PATCH /repartidores/{'{id}'}/estado.</p>
    </>}
  </>
}
