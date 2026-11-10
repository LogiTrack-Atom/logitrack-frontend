import { describe, expect, it, vi } from 'vitest'
import { SessionStore } from './session'
import { tokenMock, usuarioClienteMock } from '../mocks/auth.mock'

const credentials = { email: 'fixture@example.test', password: 'ficticia' }
function transport() {
  return { mode: 'mock' as const, login: vi.fn(async () => tokenMock), me: vi.fn(async () => usuarioClienteMock),
    register: vi.fn(async () => usuarioClienteMock), resume: vi.fn(async () => tokenMock), endSession: vi.fn(async () => undefined) }
}

describe('restauración y revocación de sesión', () => {
  it('restaura una sola vez, incluso con efectos repetidos, y verifica me antes de habilitar operaciones', async () => {
    const port = transport(); const session = new SessionStore(port)
    expect(session.getSnapshot().status).toBe('authenticating')
    await Promise.all([session.restore(), session.restore()])
    expect(port.resume).toHaveBeenCalledTimes(1)
    expect(port.me).toHaveBeenCalledTimes(1)
    expect(session.getSnapshot()).toMatchObject({ status: 'authenticated', user: usuarioClienteMock })
    expect(JSON.stringify(session.getSnapshot())).not.toContain(tokenMock.accessToken)
  })

  it('una restauración tardía no reemplaza un login posterior', async () => {
    let done!: (value: typeof tokenMock) => void
    const port = transport(); port.resume = vi.fn(() => new Promise(resolve => { done = resolve }))
    const session = new SessionStore(port); const restore = session.restore()
    await session.login(credentials)
    const epoch = session.getSnapshot().epoch
    done(tokenMock); await restore
    expect(session.getSnapshot()).toMatchObject({ status: 'authenticated', epoch })
    expect(port.me).toHaveBeenCalledTimes(1)
  })

  it('logout limpia inmediatamente y advierte si la revocación remota no se confirmó', async () => {
    const port = transport(); port.endSession.mockRejectedValueOnce(new Error('red'))
    const session = new SessionStore(port); await session.restore()
    session.logout()
    expect(session.getSnapshot().status).toBe('anonymous')
    await vi.waitFor(() => expect(session.getSnapshot().reason).toBe('logout-unconfirmed'))
    expect(port.endSession).toHaveBeenCalledTimes(1)
  })

  it('logout de otra pestaña limpia sin iniciar otra revocación ni producir un bucle', async () => {
    const port = transport(); const session = new SessionStore(port); await session.restore()
    session.clearFromAnotherTab()
    expect(session.getSnapshot().status).toBe('anonymous')
    expect(port.endSession).not.toHaveBeenCalled()
  })
})
