import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { MOCK_LABEL } from '../shared/http/mock'
import { appModules } from './modules'
import { routes } from './router'

afterEach(cleanup)

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('layout y navegación base', () => {
  it('muestra el rótulo de datos provisionales (mock)', () => {
    renderAt('/')
    expect(screen.getByRole('status').textContent).toBe(MOCK_LABEL)
  })

  it('el menú tiene un enlace por cada módulo visible', () => {
    renderAt('/')
    const menu = screen.getByRole('navigation', { name: 'Principal' })
    for (const item of appModules.filter((m) => m.showInMenu)) {
      expect(within(menu).getByRole('link', { name: item.label })).toBeTruthy()
    }
  })

  it('navega entre módulos desde el menú', async () => {
    const router = renderAt('/')
    const menu = screen.getByRole('navigation', { name: 'Principal' })

    fireEvent.click(within(menu).getByRole('link', { name: 'Envíos' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/shipments'))

    fireEvent.click(within(menu).getByRole('link', { name: 'Repartidores' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/couriers'))
  })

  it('una ruta inexistente cae en la página de no encontrado y conserva el layout', () => {
    const router = renderAt('/no-existe')
    expect(router.state.matches.at(-1)?.route.path).toBe('*')
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeTruthy()
  })

  it('el login se muestra fuera del layout principal', () => {
    renderAt('/login')
    expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull()
  })
})
