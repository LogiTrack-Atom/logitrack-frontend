import type { Role } from '../types'

type JwtPayload = { exp?: number; sub?: string; roles?: string[] }

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const segment = token.split('.')[1]
    if (!segment) return null
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
    const parsed: unknown = JSON.parse(decoded)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as JwtPayload
  } catch { return null }
}

export function isJwtFresh(token: string, nowSeconds = Date.now() / 1000): boolean {
  const payload = decodeJwt(token)
  // Sin exp no se inicia sesión. El frontend usa reloj estricto; el servidor valida firma/nbf/skew.
  return typeof payload?.exp === 'number' && Number.isFinite(payload.exp) && payload.exp > nowSeconds
}

export function tokenRoles(token: string): Role[] {
  const roles = decodeJwt(token)?.roles
  return Array.isArray(roles)
    ? roles.filter((role): role is Role => role === 'ADMIN' || role === 'CLIENTE' || role === 'REPARTIDOR')
    : []
}
