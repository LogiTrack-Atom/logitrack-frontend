import type { Token, Usuario } from '../types'

/**
 * Datos provisionales (mock). El token NO es un JWT ni una credencial: es un texto
 * fijo para que la interfaz pueda mostrar estados de sesión sin llamadas reales.
 */

export const tokenMock: Token = {
  accessToken: 'token-mock-no-valido',
  tokenType: 'Bearer',
  expiresIn: 900,
}

export const usuarioClienteMock: Usuario = {
  id: '00000000-0000-4000-8000-000000000002',
  email: 'cliente@example.com',
  roles: ['CLIENTE'],
  createdAt: '2026-11-09T12:00:00.000000Z',
  updatedAt: '2026-11-09T12:00:00.000000Z',
}
