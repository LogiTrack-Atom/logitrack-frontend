import { Link } from 'react-router'
import { PageHeader } from '../shared/components/PageHeader'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Página no encontrada" description="La dirección no existe en esta aplicación." />
      <Link to="/">Volver al inicio</Link>
    </>
  )
}
