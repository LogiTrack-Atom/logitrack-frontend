import { useMemo } from 'react'
import { useAuth } from '../../modules/auth/session/authContext'
import { createSessionHttpClient } from './sessionHttpClient'

/** Cliente privado por instancia de sesión; no usa un singleton compartido entre usuarios. */
export function useHttpClient() {
  const { session, state } = useAuth()
  return useMemo(() => createSessionHttpClient(session, undefined, state.epoch), [session, state.epoch])
}
