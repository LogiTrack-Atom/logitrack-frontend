import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AssignmentPanel } from './AssignmentPanel'
import { AuthProvider } from '../auth/session/AuthProvider'
import { SessionStore } from '../auth/session/session'
import { tokenMock } from '../auth/mocks/auth.mock'
import { mockPersonaForEmail, mockToken } from '../auth/mocks/personas'
import { createShipmentService } from './services/shipmentService'
import { envioMock } from './mocks/shipments.mock'
import { HttpError } from '../../shared/http/httpError'
const rider = '00000000-0000-4000-8000-000000000201'
const operation = { operationId: '00000000-0000-4000-8000-000000000501', envioId: envioMock.id, repartidorId: rider,
  assignmentVersion: 1, status: 'PENDING', reason: null, createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-10T00:00:00Z', expiresAt: '2026-11-10T00:05:00Z' }
async function setup() {
  const user = mockPersonaForEmail('admin@example.com')
  const store = new SessionStore({ mode: 'mock', login: async () => ({ ...tokenMock, accessToken: mockToken('ADMIN') }), me: async () => user, register: async () => user })
  await store.login({ email: user.email, password: 'ficticia' })
  const service = createShipmentService({ request: vi.fn() })
  const post = vi.spyOn(service, 'requestAssignment').mockResolvedValue({ status: 202, data: operation })
  const read = vi.spyOn(service, 'assignmentOperation').mockResolvedValue(operation)
  const detail = vi.spyOn(service, 'detail').mockResolvedValue({ ...envioMock, repartidorId: rider })
  const verified = vi.fn(), settled = vi.fn()
  render(<AuthProvider store={store}><AssignmentPanel service={service} envioId={envioMock.id} onSettled={settled} onVerified={verified} /></AuthProvider>)
  return { store, post, read, detail, verified, settled }
}
async function submit() {
  fireEvent.change(screen.getByLabelText('UUID del repartidor'), { target: { value: rider } })
  await act(async () => { fireEvent.click(screen.getByText('Solicitar asignación')) })
}
afterEach(() => { cleanup(); vi.useRealTimers() })
it('logout aborta el sondeo del componente y descarta una respuesta tardía', async () => {
  vi.useFakeTimers(); const f = await setup(); let finish!: (value: unknown) => void
  f.read.mockImplementation(() => new Promise((resolve) => { finish = resolve }))
  await submit(); await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
  const signal = f.read.mock.calls[0][1]!
  act(() => f.store.logout('logout'))
  expect(signal.aborted).toBe(true)
  await act(async () => { finish({ ...operation, status: 'APPLIED' }) })
  expect(f.detail).not.toHaveBeenCalled(); expect(f.verified).not.toHaveBeenCalled(); expect(f.settled).not.toHaveBeenCalled()
  expect(screen.queryByText(/Confirmado: el repartidor/)).toBeNull()
})
it('503 conserva intención y el reintento explícito usa la misma clave', async () => {
  vi.useFakeTimers(); const f = await setup(); f.post.mockRejectedValueOnce(new HttpError(503))
  await submit(); const key = f.post.mock.calls[0][2]
  expect(screen.getByText(/Resultado no confirmado/)).toBeTruthy()
  await act(async () => { fireEvent.click(screen.getByText('Reintentar con la misma clave')) })
  expect(f.post.mock.calls[1][2]).toBe(key)
  expect(f.post).toHaveBeenCalledTimes(2)
  expect(f.settled).not.toHaveBeenCalled()
})
