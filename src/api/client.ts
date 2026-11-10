import axios from 'axios'
import { endSession, ensureFresh, readToken, sessionSignal } from '../auth/session'

// Único destino permitido: Gateway a través de la misma origin por defecto.
// Si se configura otro origen explícitamente, ese origen es la lista blanca del despliegue.
const rawBase = (import.meta.env.VITE_API_BASE_URL || '/').trim()
const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`
const allowed = new URL(base, window.location.origin)
if (allowed.protocol !== 'https:' && allowed.protocol !== 'http:') throw new Error('Origen de API no permitido')

function authorizedTarget(url: string): boolean {
  const resolved = new URL(url.replace(/^\//, ''), allowed)
  return resolved.origin === allowed.origin && resolved.pathname.startsWith('/applications/')
}

export const publicApi = axios.create({ baseURL: base, timeout: 15000, headers: { 'Content-Type': 'application/json' } })
export const api = axios.create({ baseURL: base, timeout: 15000, headers: { 'Content-Type': 'application/json' } })

api.interceptors.request.use(config => {
  const url = String(config.url || '')
  if (!authorizedTarget(url)) throw new Error('Solicitud fuera del Gateway autorizado')
  if (!ensureFresh()) throw new Error('Necesitás iniciar sesión.')
  const token = readToken()
  if (!token) throw new Error('Necesitás iniciar sesión.')
  config.headers.set('Authorization', `Bearer ${token}`)
  config.signal ??= sessionSignal()
  return config
})

api.interceptors.response.use(response => response, error => {
  if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
    // Una sola invalidación incluso si varias solicitudes fallan simultáneamente.
    endSession()
  }
  return Promise.reject(error)
})

export const endpoints = {
  security: 'applications/apisecurity/api/v1',
  courier: 'applications/apicourier/api/v1',
  shipment: 'applications/apishipment/api/v1',
} as const
