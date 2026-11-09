import { Link } from 'react-router'
import { PagePlaceholder } from '../../shared/components/PagePlaceholder'
import styles from './LoginPage.module.css'

export function LoginPage() {
  return (
    <div className={styles.wrapper}>
      <div className={styles.panel}>
        <PagePlaceholder
          title="Iniciar sesión"
          description="El formulario y la autenticación se implementan en su propia tarea."
        />
        <Link to="/">Volver al inicio</Link>
      </div>
    </div>
  )
}
