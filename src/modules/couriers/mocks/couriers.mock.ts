import type { Disponibilidad, IdentidadRepartidor, Repartidor } from '../types'

/**
 * Datos provisionales (mock) tomados de los escenarios del borrador #71.
 * Son ficticios: no representan datos reales ni el comportamiento del backend.
 */

export const repartidorMock: Repartidor = {
  id: '00000000-0000-4000-8000-000000000201',
  nombre: 'Repartidor de ejemplo',
  tipoVehiculo: 'Bicicleta',
  estado: 'ACTIVO',
  createdAt: '2026-11-09T12:00:00.000000Z',
  updatedAt: '2026-11-09T12:00:00.000000Z',
}

export const repartidoresMock: Repartidor[] = [repartidorMock]

export const disponibilidadMock: Disponibilidad = {
  repartidorId: '00000000-0000-4000-8000-000000000201',
  estado: 'ACTIVO',
  disponible: true,
}

export const identidadRepartidorMock: IdentidadRepartidor = {
  repartidorId: '00000000-0000-4000-8000-000000000201',
  usuarioId: '00000000-0000-4000-8000-000000000003',
}
