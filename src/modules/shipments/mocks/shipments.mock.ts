import type { AsociacionUsuario, Envio, HistorialEvento } from '../types'

/**
 * Datos provisionales (mock) tomados de los escenarios del borrador #71.
 * Son ficticios: no representan datos reales ni el comportamiento del backend.
 */

export const envioMock: Envio = {
  id: '00000000-0000-4000-8000-000000000301',
  codigoSeguimiento: 'LT-MOCK-0001',
  cliente: {
    id: '00000000-0000-4000-8000-000000000101',
    nombre: 'Cliente de ejemplo',
    email: 'cliente@example.com',
    telefono: null,
  },
  repartidorId: '00000000-0000-4000-8000-000000000201',
  pesoKg: 1.25,
  anchoCm: 25.25,
  altoCm: 15.5,
  largoCm: 30.75,
  estado: 'PENDIENTE',
  origen: { calle: 'Calle de ejemplo', numero: '123', ciudad: 'Jujuy', codigoPostal: '4600' },
  destino: { calle: 'Calle de ejemplo', numero: '456', ciudad: 'Jujuy', codigoPostal: '4600' },
  createdAt: '2026-11-09T12:00:00.000000Z',
  updatedAt: '2026-11-09T12:01:00.000000Z',
}

export const enviosMock: Envio[] = [envioMock]

export const historialMock: HistorialEvento[] = [
  {
    id: '00000000-0000-4000-8000-000000000401',
    estadoAnterior: null,
    estadoNuevo: 'PENDIENTE',
    fechaCambio: '2026-11-09T12:00:00.000000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000402',
    estadoAnterior: 'PENDIENTE',
    estadoNuevo: 'EN_RUTA',
    fechaCambio: '2026-11-09T12:02:00.000000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000403',
    estadoAnterior: 'EN_RUTA',
    estadoNuevo: 'ENTREGADO',
    fechaCambio: '2026-11-09T12:03:00.000000Z',
  },
]

export const asociacionClienteMock: AsociacionUsuario = {
  recursoId: '00000000-0000-4000-8000-000000000101',
  usuarioId: '00000000-0000-4000-8000-000000000002',
}

export const asociacionRepartidorMock: AsociacionUsuario = {
  recursoId: '00000000-0000-4000-8000-000000000201',
  usuarioId: '00000000-0000-4000-8000-000000000003',
}
