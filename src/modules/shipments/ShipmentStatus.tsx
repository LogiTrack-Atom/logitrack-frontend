import type { EstadoEnvio } from './types'
import styles from './ShipmentStatus.module.css'

const labels: Record<EstadoEnvio, string> = {
  PENDIENTE: 'Pendiente',
  EN_RUTA: 'En ruta',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
}

export function ShipmentStatus({ status }: { status: EstadoEnvio }) {
  return <span className={styles.badge} data-status={status}>{labels[status]}</span>
}
