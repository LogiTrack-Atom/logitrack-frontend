import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Rol } from '../types'
import { hasAnyRole } from '../permissions'
import { useAuth } from './authContext'

/** Oculta acciones de presentación; no comprueba propiedad ni sustituye permisos backend. */
export function Allowed({ roles, children }: { roles: readonly Rol[]; children: ReactNode }) {
  const { state } = useAuth()
  return state.status === 'authenticated' && hasAnyRole(state.user, roles) ? children : null
}

/** También protege el acceso directo a un módulo oculto en el menú, sin bucle de login. */
export function RequireRole({ roles, children }: { roles: readonly Rol[]; children: ReactNode }) {
  const { state } = useAuth()
  if (state.status === 'authenticated' && hasAnyRole(state.user, roles)) return children
  return <section aria-labelledby="forbidden-title">
    <h1 id="forbidden-title">Acceso no permitido</h1>
    <p>No tenés permiso para acceder a este módulo.</p>
    <Link to="/">Volver al inicio</Link>
  </section>
}
