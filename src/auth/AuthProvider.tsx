import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { authApi } from '../api/services'
import type { Role, User } from '../types'
import { beginSession, endSession, ensureFresh, isCurrentGeneration, readToken, subscribeSession } from './session'
import { tokenRoles } from '../utils/jwt'

type AuthValue = {
  user: User | null; isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void; hasRole: (...roles: Role[]) => boolean;
}
const AuthContext = createContext<AuthValue | undefined>(undefined)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeSession(() => {
      if (!readToken()) { setUser(null); setActive(false) }
    })
    const check = () => { ensureFresh() }
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    const interval = window.setInterval(check, 12000)
    return () => { unsubscribe(); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); window.clearInterval(interval) }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email.trim(), password)
    if (!result.accessToken || result.tokenType.toLowerCase() !== 'bearer') throw new Error('La respuesta de autenticación no es válida.')
    const generation = beginSession(result.accessToken)
    try {
      const verified = await authApi.me()
      if (!isCurrentGeneration(generation)) return
      // Mostrar roles solo si el JWT y la identidad verificada coinciden.
      const claims = tokenRoles(result.accessToken)
      const roles = verified.roles.filter(role => claims.includes(role))
      if (roles.length === 0) throw new Error('La cuenta no tiene permisos compatibles con su token.')
      setUser({...verified, roles})
      setActive(true)
    } catch (error) { if (isCurrentGeneration(generation)) endSession(); throw error }
  }, [])
  const logout = useCallback(() => { endSession(); setUser(null); setActive(false) }, [])
  const hasRole = useCallback((...roles: Role[]) => !!user && roles.some(r => user.roles.includes(r)), [user])
  const value = useMemo(() => ({user, isAuthenticated: active && !!user && !!readToken(), login, logout, hasRole}), [user, active, login, logout, hasRole])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider requerido'); return value }
