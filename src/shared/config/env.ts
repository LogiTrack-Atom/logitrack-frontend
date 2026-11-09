/** Base de la API. Por defecto '/api' (proxy de Vite en desarrollo, nginx en Docker). */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api'

/** Los mocks quedan activos salvo que VITE_USE_MOCKS sea exactamente 'false'. */
export const USE_MOCKS: boolean = import.meta.env.VITE_USE_MOCKS !== 'false'
