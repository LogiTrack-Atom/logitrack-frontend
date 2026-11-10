import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './authContext'
import { SessionStore } from './session'
import { activeAuthTransport } from './sessionClient'

/** Una instancia por aplicación; nunca restaura tokens después de una recarga. */
export function AuthProvider({ children, store }: { children: ReactNode; store?: SessionStore }) {
  const [session] = useState(() => store ?? new SessionStore(activeAuthTransport))
  useEffect(() => {
    const check = () => { session.checkExpiry() }
    window.addEventListener('focus', check)
    window.addEventListener('pageshow', check)
    document.addEventListener('visibilitychange', check)
    check()
    return () => {
      window.removeEventListener('focus', check)
      window.removeEventListener('pageshow', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [session])
  return <AuthContext.Provider value={session}>{children}</AuthContext.Provider>
}
