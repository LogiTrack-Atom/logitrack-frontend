import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './authContext'
import { SessionStore } from './session'
import { LOGOUT_PENDING } from './browserSessionClient'
import { activeAuthTransport } from './sessionClient'

/** Una instancia por aplicación; restaura acceso mediante cookie HttpOnly en modo real. */
export function AuthProvider({ children, store }: { children: ReactNode; store?: SessionStore }) {
  const [session] = useState(() => store ?? new SessionStore(activeAuthTransport))
  useEffect(() => {
    void session.restore()
    const storage = (event: StorageEvent) => { if (event.key === LOGOUT_PENDING && event.newValue) session.clearFromAnotherTab() }
    window.addEventListener('storage', storage)
    const check = () => { session.checkExpiry() }
    window.addEventListener('focus', check)
    window.addEventListener('pageshow', check)
    document.addEventListener('visibilitychange', check)
    check()
    return () => {
      window.removeEventListener('storage', storage)
      window.removeEventListener('focus', check)
      window.removeEventListener('pageshow', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [session])
  return <AuthContext.Provider value={session}>{children}</AuthContext.Provider>
}
