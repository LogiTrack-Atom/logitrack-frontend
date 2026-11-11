import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from '../../app/router'
import { AuthProvider } from '../auth/session/AuthProvider'
import { AdminWorkspace } from './AdminPage'
import { fixture, finishFixtures, account, courier } from './testing/fixture'

function submitAccount(email = account.email, password = account.password) {
  fireEvent.change(screen.getByLabelText('Correo de la nueva cuenta'), { target: { value: email } })
  fireEvent.change(screen.getByLabelText('Contraseña inicial'), { target: { value: password } })
  fireEvent.submit(screen.getByRole('button', { name: 'Crear cuenta' }).closest('form')!)
}
afterEach(() => { cleanup(); finishFixtures(); vi.restoreAllMocks() })

describe('administración por pasos', () => {
  it('completa el flujo, limpia password y exige confirmar la limpieza local sin borrar recursos', async () => {
    const f = await fixture(), storage = vi.spyOn(Storage.prototype, 'setItem')
    render(<AdminWorkspace flow={f.flow} />)
    submitAccount()
    expect(screen.getByLabelText('Contraseña inicial')).toHaveProperty('value', '')
    await screen.findByText('Cuenta: confirmado')
    fireEvent.change(screen.getByLabelText('Nombre del repartidor'), { target: { value: courier.nombre } })
    fireEvent.change(screen.getByLabelText('Vehículo del repartidor'), { target: { value: courier.tipoVehiculo } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear ficha Courier' }))
    await screen.findByText('Ficha Courier: confirmado')
    fireEvent.click(screen.getByRole('button', { name: 'Verificar y vincular Courier' }))
    await screen.findByText('Vínculo Courier: confirmado')
    fireEvent.click(screen.getByRole('button', { name: 'Registrar referencia Shipment' }))
    await screen.findByText('Referencia Shipment: confirmado')
    const id = f.flow.getSnapshot().userId!
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar progreso local' }))
    expect(f.flow.getSnapshot().userId).toBe(id)
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar limpieza local' }))
    expect(f.flow.getSnapshot().userId).toBeNull()
    expect(f.directory.find(id)?.id).toBe(id)
    expect(storage).not.toHaveBeenCalled()
  })

  it('un POST perdido bloquea otro envío y permite recuperar un ID externo validado', async () => {
    const f = await fixture(); f.fail('user', 'after')
    render(<AdminWorkspace flow={f.flow} />)
    submitAccount()
    await screen.findByText('Resultado incierto en: alta de cuenta.')
    const submit = screen.getByRole('button', { name: 'Crear cuenta' })
    expect(submit).toHaveProperty('disabled', true)
    await act(async () => { fireEvent.submit(submit.closest('form')!) })
    expect(f.count('user')).toBe(1)
    fireEvent.change(screen.getByLabelText('usuarioId a recuperar'), { target: { value: f.captured.get('user')! } })
    fireEvent.click(screen.getByRole('button', { name: 'Validar y recuperar IDs' }))
    await screen.findByText('Cuenta: confirmado')
    expect(f.count('user')).toBe(1)
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toHaveProperty('disabled', true)
  })

  it('valida el límite UTF-8 sin enviar credenciales inválidas', async () => {
    const f = await fixture()
    render(<AdminWorkspace flow={f.flow} />)
    submitAccount(account.email, 'á'.repeat(37))
    await screen.findByText('Revisá correo, rol y contraseña: 12 a 72 caracteres y hasta 72 bytes UTF-8.')
    expect(f.count('user')).toBe(0)
    expect(screen.getByLabelText('Contraseña inicial')).toHaveProperty('value', '')
  })

  it('no confirma Shipment por revalidar lecturas después de perder su PUT', async () => {
    const f = await fixture()
    await f.flow.createUser(account); await f.flow.createCourier(courier); await f.flow.linkCourier()
    f.fail('shipmentLink', 'after')
    render(<AdminWorkspace flow={f.flow} />)
    fireEvent.click(screen.getByRole('button', { name: 'Registrar referencia Shipment' }))
    await screen.findByText('Resultado incierto en: referencia Shipment.')
    fireEvent.click(screen.getByRole('button', { name: 'Revalidar lecturas conocidas' }))
    await screen.findByText('Lecturas confirmadas. Shipment no ofrece GET de asociación; un resultado incierto sigue pendiente.')
    expect(screen.getByText('Referencia Shipment: pendiente')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Revalidar y repetir el mismo vínculo Shipment' }))
    await screen.findByText('Referencia Shipment: confirmado')
    expect(f.count('shipmentLink')).toBe(2)
    expect(f.count('user')).toBe(1); expect(f.count('courier')).toBe(1)
  })

  it('la asociación opcional exige una cuenta CLIENTE', async () => {
    const f = await fixture(); await f.flow.createUser(account)
    render(<AdminWorkspace flow={f.flow} />)
    fireEvent.change(screen.getByLabelText('clienteId local'), { target: { value: '00000000-0000-4000-8000-000000000101' } })
    fireEvent.change(screen.getByLabelText('usuarioId CLIENTE'), { target: { value: f.flow.getSnapshot().userId! } })
    fireEvent.click(screen.getByRole('button', { name: 'Vincular cliente' }))
    await screen.findByText('La cuenta debe tener rol CLIENTE.')
    expect(f.count('clientLink')).toBe(0)
  })

  it.each(['CLIENTE', 'REPARTIDOR'] as const)('%s no entra a Administración ni ve el enlace del menú', async (role) => {
    const f = await fixture(role)
    const router = createMemoryRouter(routes, { initialEntries: ['/admin'] })
    render(<AuthProvider store={f.session}><RouterProvider router={router} /></AuthProvider>)
    await screen.findByRole('heading', { name: 'Acceso no permitido' })
    expect(screen.queryByRole('link', { name: 'Administración' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Crear cuenta' })).toBeNull()
  })

  it('navegar conserva el flujo; logout e historial no recuperan IDs privados', async () => {
    const f = await fixture()
    const router = createMemoryRouter(routes, { initialEntries: ['/admin'] })
    render(<AuthProvider store={f.session}><RouterProvider router={router} /></AuthProvider>)
    submitAccount('persistencia.ficticia@example.com')
    await screen.findByText('Cuenta: confirmado')
    const id = screen.getByTestId('confirmed-user-id').textContent
    fireEvent.click(screen.getByRole('link', { name: 'Inicio' }))
    await screen.findByRole('heading', { name: 'Inicio' })
    fireEvent.click(screen.getByRole('link', { name: 'Administración' }))
    await screen.findByText('Cuenta: confirmado')
    expect(screen.getByTestId('confirmed-user-id').textContent).toBe(id)
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    await screen.findByRole('heading', { name: 'Iniciar sesión' })
    await act(() => router.navigate(-1))
    expect(screen.queryByTestId('confirmed-user-id')).toBeNull()
    await act(async () => { await f.session.login({ email: 'admin@example.com', password: 'ficticia' }); await router.navigate('/admin') })
    await screen.findByRole('heading', { name: 'Administración' })
    expect(screen.queryByTestId('confirmed-user-id')).toBeNull()
  })
})
