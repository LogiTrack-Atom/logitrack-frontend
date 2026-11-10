import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { MOCK_LABEL } from '../shared/http/mock'
import { appModules } from './modules'
import { routes } from './router'
import { AuthProvider } from '../modules/auth/session/AuthProvider'
import { SessionStore } from '../modules/auth/session/session'
import { usuarioClienteMock, tokenMock } from '../modules/auth/mocks/auth.mock'

afterEach(cleanup)

async function renderAt(path: string) {
  const store = new SessionStore({ mode: 'mock', login: async () => tokenMock, me: async () => ({ ...usuarioClienteMock, roles: ['ADMIN'] }), register: async () => usuarioClienteMock })
  if (path !== '/login') await store.login({ email: 'demo@example.com', password: 'demo' })
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<AuthProvider store={store}><RouterProvider router={router} /></AuthProvider>)
  return router
}

describe('layout y navegación base', () => {
  it('muestra el rótulo de datos provisionales (mock)', async () => {
    await renderAt('/')
    expect(screen.getByRole('status').textContent).toBe(MOCK_LABEL)
  })

  it('el menú tiene un enlace por cada módulo visible', async () => {
    await renderAt('/')
    const menu = screen.getByRole('navigation', { name: 'Principal' })
    for (const item of appModules.filter((m) => m.showInMenu)) {
      expect(within(menu).getByRole('link', { name: item.label })).toBeTruthy()
    }
  })

  it('navega entre módulos desde el menú', async () => {
    const router = await renderAt('/')
    const menu = screen.getByRole('navigation', { name: 'Principal' })

    fireEvent.click(within(menu).getByRole('link', { name: 'Envíos' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/shipments'))

    fireEvent.click(within(menu).getByRole('link', { name: 'Repartidores' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/couriers'))
  })

  it('una ruta inexistente cae en la página de no encontrado y conserva el layout', async () => {
    const router = await renderAt('/no-existe')
    expect(router.state.matches.at(-1)?.route.path).toBe('*')
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeTruthy()
  })

  it('el login se muestra fuera del layout principal', async () => {
    await renderAt('/login')
    expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull()
  })
})
