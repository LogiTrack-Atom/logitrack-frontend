import { createContext, useContext, useSyncExternalStore } from 'react'
import type { SessionStore } from './session'

export const AuthContext = createContext<SessionStore | null>(null)

/** Acceso a una instantánea reactiva sin exponer el token al árbol de componentes. */
export function useAuth() {
  const session = useContext(AuthContext)
  if (!session) throw new Error('AuthProvider es obligatorio.')
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot)
  return { session, state }
}
