import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './authContext'

/** Desmonta datos privados al terminar/cambiar la sesión; también cubre atrás/adelante. */
export function RequireSession() {
  const { state } = useAuth()
  const location = useLocation()
  if (state.status === 'authenticating') return <p role="status">Recuperando sesión…</p>
  if (state.status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ returnTo: location.pathname }} />
  }
  return <Outlet key={state.epoch} />
}
