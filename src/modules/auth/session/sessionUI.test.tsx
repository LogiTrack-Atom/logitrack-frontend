import { mockToken } from '../mocks/personas'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '../../../app/router'
import { usuarioClienteMock, tokenMock } from '../mocks/auth.mock'
import { AuthProvider } from './AuthProvider'
import { SessionStore } from './session'
import type { AuthTransport } from './session'

const credentials = { email: 'cliente@example.com', password: 'demo-no-real' }
function setup(path = '/shipments', overrides: Partial<AuthTransport> = {}) {
  const login = vi.fn(async () => ({ ...tokenMock, accessToken: mockToken('CLIENTE') }))
  const register = vi.fn(async () => usuarioClienteMock)
  const session = new SessionStore({ mode: 'mock', login, register, me: async () => usuarioClienteMock, ...overrides })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const view = render(<AuthProvider store={session}><RouterProvider router={router} /></AuthProvider>)
  return { session, router, login, register, ...view }
}
function fillAndSubmit(password = credentials.password) {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: credentials.email } })
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } })
  fireEvent.submit(screen.getByRole('button', { name: /Ingresar|Crear cuenta$/ }).closest('form')!)
}
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('autenticación y navegación', () => {
  it('redirige la ruta privada, autentica y vuelve al módulo pedido sin escribir Web Storage', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const { router } = setup()
    await screen.findByRole('heading', { name: 'Iniciar sesión' })
    expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull()
    fillAndSubmit()
    await screen.findByRole('button', { name: 'Cerrar sesión' })
    expect(router.state.location.pathname).toBe('/shipments')
    expect(storage).not.toHaveBeenCalled()
    expect(router.state.location.search).toBe('')
  })

  it('logout desmonta el layout y atrás/adelante no permite recuperarlo', async () => {
    const { router } = setup('/login')
    fillAndSubmit()
    await screen.findByRole('button', { name: 'Cerrar sesión' })
    await act(() => router.navigate('/shipments'))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await screen.findByRole('heading', { name: 'Iniciar sesión' })
    await act(() => router.navigate(-1))
    expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull()
    await act(() => router.navigate(1))
    expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull()
  })

  it('foco detecta el vencimiento aun si el reloj avanzó con la pestaña suspendida', async () => {
    const { session } = setup('/login')
    fillAndSubmit()
    await screen.findByRole('button', { name: 'Cerrar sesión' })
    const expiry = session.getSnapshot().expiresAt!
    vi.spyOn(Date, 'now').mockReturnValue(expiry)
    fireEvent.focus(window)
    await screen.findByText('Tu sesión venció. Ingresá nuevamente.')
    expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull()
  })

  it('registro no permite elegir rol y no autentica automáticamente', async () => {
    const { session, register } = setup('/register')
    expect(screen.queryByRole('combobox')).toBeNull()
    fillAndSubmit('demostracion-segura')
    await screen.findByText('Registro completado. Podés iniciar sesión.')
    expect(register.mock.calls).toHaveLength(1)
    expect(session.getSnapshot().status).toBe('anonymous')
    expect(screen.getByLabelText('Contraseña')).toHaveProperty('value', '')
  })

  it('valida el límite en bytes UTF-8 sin enviar el registro', () => {
    const { register } = setup('/register')
    fillAndSubmit('á'.repeat(37))
    expect(screen.getByRole('alert').textContent).toContain('72 bytes UTF-8')
    expect(register).not.toHaveBeenCalled()
  })

  it('limpia la contraseña y muestra un mensaje seguro ante un error del transporte', async () => {
    setup('/login', { login: async () => { throw new Error('detalle interno con secretos') } })
    fillAndSubmit()
    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent).not.toContain('secretos')
    expect(screen.getByLabelText('Contraseña')).toHaveProperty('value', '')
  })

  it('salir del formulario cancela una autenticación pendiente', async () => {
    let signal!: AbortSignal
    const { session, router } = setup('/login', {
      login: (_credentials, current) => { signal = current; return new Promise(() => {}) },
    })
    fillAndSubmit()
    await act(() => router.navigate('/register'))
    expect(signal.aborted).toBe(true)
    expect(session.getSnapshot().status).toBe('anonymous')
  })

  it('volver a montar la aplicación exige login, sin recuperar el token anterior', async () => {
    const first = setup('/login')
    fillAndSubmit()
    await screen.findByRole('button', { name: 'Cerrar sesión' })
    first.unmount()
    const second = setup('/shipments')
    await waitFor(() => expect(second.router.state.location.pathname).toBe('/login'))
    expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull()
  })
})
