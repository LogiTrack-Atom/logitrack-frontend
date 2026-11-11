import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/session/authContext'
import { hasAnyRole, UI_ROLES } from '../auth/permissions'
import { ShipmentStatus } from '../shipments/ShipmentStatus'
import type { Envio } from '../shipments/types'
import { useShipmentService } from '../shipments/useShipmentService'
import { RequestErrorNotice } from '../../shared/components/RequestErrorNotice'
import styles from './HomePage.module.css'

export function HomePage() {
  const { state } = useAuth()
  const shipments = useShipmentService()
  const [items, setItems] = useState<Envio[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const admin = hasAnyRole(state.user, UI_ROLES.administration)
  const courier = state.user?.roles.includes('REPARTIDOR')

  useEffect(() => {
    const controller = new AbortController()
    shipments.list(undefined, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setItems(result) })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause) })
    return () => controller.abort()
  }, [shipments])

  const metrics = [
    { title: 'Envíos visibles', count: items?.length, tone: 'total', icon: '◇' },
    { title: 'Pendientes', count: items?.filter((item) => item.estado === 'PENDIENTE').length, tone: 'pending', icon: '◷' },
    { title: 'En ruta', count: items?.filter((item) => item.estado === 'EN_RUTA').length, tone: 'route', icon: '↗' },
    { title: 'Entregados', count: items?.filter((item) => item.estado === 'ENTREGADO').length, tone: 'delivered', icon: '✓' },
  ]
  const recent = items?.toSorted((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5)
  const description = admin ? 'Revisá el estado de los envíos y accedé a tus operaciones.'
    : courier ? 'Revisá los envíos asignados a tu cuenta.' : 'Consultá el estado y el seguimiento de tus envíos.'

  return (
    <div className={styles.dashboard}>
      <header>
        <h1>Inicio</h1>
        <p>{description}</p>
      </header>

      <section className={styles.hero} aria-labelledby="shipment-overview">
        <div>
          <h2 id="shipment-overview">{admin ? 'Operaciones de envíos' : courier ? 'Entregas asignadas' : 'Mis envíos'}</h2>
          <Link to="/shipments" className={styles.heroLink}>Consultar envíos <span aria-hidden="true">→</span></Link>
        </div>
        <img src="/assets/branding/logitrack-isotipo-contraste.webp" alt="" width="464" height="424" />
      </section>

      <section className={styles.metrics} aria-label="Resumen de envíos">
        {metrics.map(({ title, count, tone, icon }) => (
          <div className={styles.metric} key={tone} data-tone={tone}>
            <span className={styles.metricIcon} aria-hidden="true">{icon}</span>
            <h2>{title}</h2>
            <strong>{count ?? '—'}</strong>
          </div>
        ))}
      </section>

      <section className={styles.recent} aria-labelledby="recent-shipments">
        <div className={styles.recentHeader}>
          <h2 id="recent-shipments">Envíos recientes</h2>
          <Link to="/shipments">Ver listado <span aria-hidden="true">→</span></Link>
        </div>
        {error !== null && <RequestErrorNotice error={error} />}
        {!items && error === null && <p role="status">Cargando resumen de envíos…</p>}
        {recent?.length === 0 && <p>Todavía no hay envíos visibles para tu cuenta.</p>}
        {recent && recent.length > 0 && (
          <ul className={styles.recentList}>
            {recent.map((item) => (
              <li key={item.id}>
                <div><strong>{item.codigoSeguimiento}</strong><span>{item.origen.ciudad} → {item.destino.ciudad}</span></div>
                <ShipmentStatus status={item.estado} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
