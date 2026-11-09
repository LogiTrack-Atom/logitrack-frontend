import { API_BASE_URL } from '../config/env'
import { HttpError } from './httpError'

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
}

/**
 * Cliente HTTP base. Todavía no lo usa ningún servicio de forma real:
 * mientras la integración esté pendiente los módulos pasan por withMock (ver mock.ts).
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const hasBody = options.body !== undefined

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: hasBody ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  })

  const text = await response.text()
  const data: unknown = text ? safeParse(text) : undefined

  if (!response.ok) {
    throw new HttpError(response.status, messageFrom(data) ?? response.statusText, data)
  }
  return data as T
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** Busca el mensaje en los campos habituales de un DTO de error o de un ProblemDetail. */
function messageFrom(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const fields = data as Record<string, unknown>
  for (const key of ['mensaje', 'message', 'detail']) {
    const value = fields[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return undefined
}
