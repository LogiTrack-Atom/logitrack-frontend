import { API_PREFIX } from '../config/api'
import { API_BASE_URL } from '../config/env'
import { RequestError } from './httpError'

function hasControl(value: string): boolean {
  return Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
}

/**
 * Resuelve solo el origen Gateway configurado y los prefijos de negocio conocidos.
 * Rechaza credenciales, fragmentos, cambios de origen y rutas ambiguas antes de fetch.
 */
export function gatewayUrl(path: string, base = API_BASE_URL, pageOrigin = window.location.origin): string {
  try {
    if (!path || (hasControl(path) || /[\s\\]/.test(path)) || path.startsWith('//')) throw new Error()
    const origin = new URL(base || pageOrigin)
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password
      || origin.pathname !== '/' || origin.search || origin.hash) throw new Error()
    if (!path.startsWith('/') && !/^https?:\/\//.test(path)) throw new Error()
    // No permitir segmentos escapados que un proxy pueda volver a interpretar como rutas.
    for (const segment of path.split(/[?#]/)[0].split('/')) {
      const decoded = decodeURIComponent(segment)
      if (decoded === '.' || decoded === '..' || hasControl(decoded) || /[/\\%]/.test(decoded)) throw new Error()
    }
    const url = new URL(path, `${origin.origin}/`)
    if (url.origin !== origin.origin || url.username || url.password || url.hash
      || !Object.values(API_PREFIX).some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) throw new Error()
    return !base && path.startsWith('/') ? `${url.pathname}${url.search}` : url.href
  } catch {
    throw new RequestError('destination')
  }
}
