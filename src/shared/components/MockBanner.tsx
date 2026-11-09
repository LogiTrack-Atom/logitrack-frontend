import { MOCK_LABEL } from '../http/mock'
import styles from './MockBanner.module.css'

export function MockBanner() {
  return (
    <div className={styles.banner} role="status">
      {MOCK_LABEL}
    </div>
  )
}
