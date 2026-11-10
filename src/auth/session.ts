import { isJwtFresh } from '../utils/jwt'

// Solo memoria: no localStorage, sessionStorage, cookies ni IndexedDB.
let token: string | null = null
let generation = 0
let controller = new AbortController()
const subscribers = new Set<() => void>()

export function readToken(): string | null { return token }
export function sessionGeneration(): number { return generation }
export function sessionSignal(): AbortSignal { return controller.signal }
export function isCurrentGeneration(value: number): boolean { return generation === value && token !== null }
export function subscribeSession(fn: () => void): () => void { subscribers.add(fn); return () => { subscribers.delete(fn) } }
function notify() { for (const listener of subscribers) listener() }

export function beginSession(nextToken: string): number {
  if (!isJwtFresh(nextToken)) throw new Error('La sesión recibida está vencida o es inválida.')
  controller.abort()
  generation += 1
  controller = new AbortController()
  token = nextToken
  notify()
  return generation
}

export function endSession(): void {
  if (!token) return
  controller.abort()
  token = null
  generation += 1
  controller = new AbortController()
  notify()
}

export function ensureFresh(): boolean {
  if (!token) return false
  if (!isJwtFresh(token)) { endSession(); return false }
  return true
}
