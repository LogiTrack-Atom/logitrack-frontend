import { PageHeader } from './PageHeader'
import styles from './PagePlaceholder.module.css'

interface PagePlaceholderProps {
  title: string
  description: string
}

/** Pantalla provisional de un módulo que todavía no se implementó. */
export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <section className={styles.card}>
        <p>Módulo pendiente de implementación. Esta pantalla es un placeholder.</p>
      </section>
    </>
  )
}
