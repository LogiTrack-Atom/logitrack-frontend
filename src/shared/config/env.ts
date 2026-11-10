/** Base de la API. Vacía por defecto: rutas /applications/... del mismo origen (proxy de Vite en dev, Nginx en Docker). */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? ''

/** Los mocks quedan activos salvo que VITE_USE_MOCKS sea exactamente 'false'. */
export const USE_MOCKS: boolean = import.meta.env.VITE_USE_MOCKS !== 'false'
