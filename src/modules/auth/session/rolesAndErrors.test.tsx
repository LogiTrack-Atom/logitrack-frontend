import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '../../../app/router'
import { RequestErrorNotice } from '../../../shared/components/RequestErrorNotice'
import { HttpError, RequestError } from '../../../shared/http/httpError'
import { createSessionHttpClient } from '../../../shared/http/sessionHttpClient'
import { API_PREFIX } from '../../../shared/config/api'
import { tokenMock, usuarioClienteMock } from '../mocks/auth.mock'
import { hasAnyRole, UI_ROLES } from '../permissions'
import type { Rol } from '../types'
import { AuthProvider } from './AuthProvider'
import { SessionStore } from './session'
import { Allowed } from './RequireRole'

const credentials = { email: 'cliente@example.com', password: 'demo' }
async function setup(roles: Rol[], path = '/') {
  const user = { ...usuarioClienteMock, roles }
  const session = new SessionStore({ mode: 'mock', login: async () => tokenMock, me: async () => user, register: async () => user })
  await session.login(credentials)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<AuthProvider store={session}><RouterProvider router={router} /></AuthProvider>)
  return { session, router }
}
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('presentación por roles', () => {
  it.each<Rol>(['ADMIN', 'REPARTIDOR'])('%s ve Courier y accede al módulo', async (role) => {
    await setup([role], '/couriers')
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(nav).getByRole('link', { name: 'Repartidores' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Repartidores' })).toBeTruthy()
  })

  it('CLIENTE no ve Courier ni puede acceder escribiendo su URL, pero conserva su sesión', async () => {
    const { session } = await setup(['CLIENTE'], '/couriers')
    const nav = screen.getByRole('navigation', { name: 'Principal' })
    expect(within(nav).queryByRole('link', { name: 'Repartidores' })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Acceso no permitido' })).toBeTruthy()
    fireEvent.click(screen.getByRole('link', { name: 'Volver al inicio' }))
    await screen.findByRole('heading', { name: 'Inicio' })
    expect(session.getSnapshot().status).toBe('authenticated')
  })

  it('múltiples roles habilitan presentación, sin inferir pertenencia de recursos', async () => {
    const { session } = await setup(['CLIENTE', 'ADMIN'])
    expect(hasAnyRole(session.getSnapshot().user, UI_ROLES.administration)).toBe(true)
    expect(hasAnyRole(null, UI_ROLES.all)).toBe(false)
  })

  it('Allowed actualiza las acciones al cerrar sesión', async () => {
    const user = { ...usuarioClienteMock, roles: ['ADMIN'] as Rol[] }
    const session = new SessionStore({ mode: 'mock', login: async () => tokenMock, me: async () => user, register: async () => user })
    await session.login(credentials)
    render(<AuthProvider store={session}><Allowed roles={UI_ROLES.administration}><button>Acción administrativa</button></Allowed></AuthProvider>)
    expect(screen.getByRole('button', { name: 'Acción administrativa' })).toBeTruthy()
    act(() => session.logout())
    expect(screen.queryByRole('button', { name: 'Acción administrativa' })).toBeNull()
  })
})

describe('errores globales y redirección', () => {
  it('401/403 concurrentes redirigen al login una vez y no vuelven a pedir automáticamente', async () => {
    const { session, router } = await setup(['CLIENTE'], '/shipments')
    const logout = vi.spyOn(session, 'logout')
    const send = vi.fn(async () => { throw new HttpError(401) })
    const client = createSessionHttpClient(session, send)
    await act(async () => {
      await Promise.allSettled([client.request(`${API_PREFIX.shipment}/envios`), client.request(`${API_PREFIX.shipment}/envios`)])
    })
    await screen.findByRole('heading', { name: 'Iniciar sesión' })
    expect(screen.getByRole('alert').textContent).toContain('el servicio rechazó el acceso')
    expect(logout).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledTimes(2)
    expect(router.state.location.pathname).toBe('/login')
    await act(() => router.navigate(-1))
    expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull()
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('un 401 en login público muestra error sin un ciclo de redirecciones', async () => {
    const login = vi.fn(async () => { throw new HttpError(401) })
    const session = new SessionStore({ mode: 'mock', login, me: async () => usuarioClienteMock, register: async () => usuarioClienteMock })
    const router = createMemoryRouter(routes, { initialEntries: ['/login'] })
    render(<AuthProvider store={session}><RouterProvider router={router} /></AuthProvider>)
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: credentials.email } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: credentials.password } })
    fireEvent.submit(screen.getByRole('button', { name: 'Ingresar' }).closest('form')!)
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No se pudo iniciar sesión'))
    expect(login).toHaveBeenCalledTimes(1)
    expect(router.state.location.pathname).toBe('/login')
  })

  it.each([400, 409, 422, 502, 503])('renderiza un %i como texto seguro y accesible', (status) => {
    const { container } = render(<RequestErrorNotice error={new HttpError(status)} />)
    expect(screen.getByRole('alert').textContent).toBeTruthy()
    expect(container.querySelector('script,img,iframe')).toBeNull()
  })

  it('no muestra mensajes arbitrarios ni trata cancelaciones como fallas', () => {
    const view = render(<RequestErrorNotice error={new Error('<script>secreto</script>')} />)
    expect(screen.getByRole('alert').textContent).toBe('No se pudo completar la operación.')
    view.rerender(<RequestErrorNotice error={new DOMException('cancelado', 'AbortError')} />)
    expect(screen.queryByRole('alert')).toBeNull()
    view.rerender(<RequestErrorNotice error={new RequestError('network')} />)
    expect(screen.getByRole('alert').textContent).toContain('verificá el resultado')
  })
})
