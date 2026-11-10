import { USE_MOCKS } from '../config/env'

/** Texto que debe verse siempre que la pantalla trabaje con datos provisionales. */
export const MOCK_LABEL = 'Datos provisionales (mock): sin conexión real con el backend.'

/** Simula una respuesta de red con datos provisionales. */
export function mockResponse<T>(data: T, delayMs = 250): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(structuredClone(data)), delayMs)
  })
}

/**
 * Devuelve los datos mock mientras los mocks estén activos; si no, ejecuta la llamada real.
 * Todos los servicios de los módulos deberían pasar por acá.
 */
export function withMock<T>(mockData: T, realCall: () => Promise<T>): Promise<T> {
  return USE_MOCKS ? mockResponse(mockData) : realCall()
}
