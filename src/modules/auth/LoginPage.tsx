import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { Button } from '../../shared/components/Button'
import { MockBanner } from '../../shared/components/MockBanner'
import { USE_MOCKS } from '../../shared/config/env'
import { useAuth } from './session/authContext'
import styles from './LoginPage.module.css'

/** Solo admite destinos internos conocidos; nunca refleja tokens/query strings en la URL. */
function returnPath(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('returnTo' in state)) return '/'
  return ['/shipments', '/couriers', '/admin'].includes(String(state.returnTo)) ? String(state.returnTo) : '/'
}

/** Login y registro público CLIENTE. La contraseña permanece únicamente en el formulario. */
export function LoginPage({ register = false }: { register?: boolean }) {
  const { session, state } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [registered, setRegistered] = useState(false)
  const busy = state.status === 'authenticating'

  useEffect(() => () => { session.cancelAuthentication() }, [session])

  if (state.status === 'authenticated') return <Navigate to={returnPath(location.state)} replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setRegistered(false)
    const bytes = new TextEncoder().encode(password).length
    if (password.length > 72 || bytes > 72 || (register && password.length < 12)) {
      setError('La contraseña debe tener como máximo 72 caracteres y 72 bytes UTF-8; para registrarse, al menos 12 caracteres.')
      return
    }
    const credentials = { email: email.trim().toLowerCase(), password }
    setPassword('')
    try {
      if (register) {
        await session.register(credentials)
        setRegistered(true)
      } else await session.login(credentials)
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la operación.')
    }
  }

  return (
    <main className={styles.wrapper}>
      <section className={styles.panel} aria-labelledby="auth-title">
        {USE_MOCKS && <MockBanner />}
        <h1 id="auth-title">{register ? 'Crear cuenta de cliente' : 'Iniciar sesión'}</h1>
        {USE_MOCKS && <p>Demostración sin cuentas reales: cliente@example.com, admin@example.com y repartidor@example.com. Usá una contraseña ficticia; no se valida contra un servidor.</p>}
        <p>La sesión se conserva al navegar. Al recargar, tendrás que ingresar nuevamente.</p>
        {state.reason === 'expired' && <p role="alert">Tu sesión venció. Ingresá nuevamente.</p>}
        {state.reason === 'unauthorized' && <p role="alert">La sesión terminó porque el servicio rechazó el acceso. Ingresá nuevamente.</p>}
        {error && <p role="alert">{error}</p>}
        {registered && <p role="status">Registro completado. Podés iniciar sesión.</p>}
        <form onSubmit={submit} className={styles.form} aria-busy={busy}>
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} />
          <label htmlFor="password">Contraseña</label>
          <input id="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 12 : 1} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
          <Button type="submit" disabled={busy}>{busy ? 'Procesando…' : register ? 'Crear cuenta' : 'Ingresar'}</Button>
        </form>
        <Link to={register ? '/login' : '/register'}>{register ? 'Ya tengo cuenta' : 'Crear cuenta de cliente'}</Link>
      </section>
    </main>
  )
}
