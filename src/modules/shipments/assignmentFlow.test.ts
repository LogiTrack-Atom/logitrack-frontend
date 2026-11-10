import { describe, expect, it } from 'vitest'
import { HttpError, RequestError } from '../../shared/http/httpError'
import { parseOperation } from './assignment'
import type { AssignmentOperation } from './assignment'
import { VISUAL_TIMEOUT_MS, refreshOperation, runAssignment } from './assignmentFlow'
import type { AssignmentApi, AssignmentView } from './assignmentFlow'

const ENVIO = '33333333-3333-4333-8333-333333333333'
const COURIER = '44444444-4444-4444-8444-444444444444'
const OPERATION = '22222222-2222-4222-8222-222222222222'
const intent = { envioId: ENVIO, repartidorId: COURIER, idempotencyKey: '66666666-6666-4666-8666-666666666666' }

function operation(status: string, extra: Record<string, unknown> = {}) {
  return {
    operationId: OPERATION,
    envioId: ENVIO,
    repartidorId: COURIER,
    assignmentVersion: 1,
    status,
    reason: null,
    createdAt: '2026-11-10T15:00:00Z',
    updatedAt: '2026-11-10T15:00:00Z',
    expiresAt: '2026-11-10T15:05:00Z',
    ...extra,
  }
}

function pending(): AssignmentOperation {
  const parsed = parseOperation(operation('PENDING'))
  if (!parsed) throw new Error('fixture inválido')
  return parsed
}

function harness() {
  const views: AssignmentView[] = []
  const waits: number[] = []
  return {
    views,
    waits,
    emit: (view: AssignmentView) => {
      views.push(view)
    },
    wait: (ms: number) => {
      waits.push(ms)
      return Promise.resolve()
    },
    phases: () => views.map((view) => view.phase),
  }
}

function apiWith(read: AssignmentApi['read'], request?: AssignmentApi['request']): AssignmentApi {
  return { request: request ?? (() => Promise.resolve({ status: 202, data: operation('PENDING') })), read }
}

describe('asignación asíncrona', () => {
  it('un 202 no es éxito: solo confirma APPLIED de la operación consultada', async () => {
    const h = harness()
    let posts = 0
    const api = apiWith(
      () => Promise.resolve(operation('APPLIED')),
      () => {
        posts += 1
        return Promise.resolve({ status: 202, data: operation('PENDING') })
      },
    )
    await runAssignment(api, intent, new AbortController().signal, h.emit, h.wait)
    expect(h.phases()).toEqual(['requesting', 'requested', 'confirmed'])
    expect(posts).toBe(1)
  })

  it('rechazo y reemplazo se informan como rechazados', async () => {
    for (const status of ['REJECTED', 'SUPERSEDED', 'EXPIRED']) {
      const h = harness()
      await runAssignment(apiWith(() => Promise.resolve(operation(status))), intent, new AbortController().signal, h.emit, h.wait)
      expect(h.phases()).toEqual(['requesting', 'requested', 'rejected'])
    }
  })

  it('una operación de otro envío no confirma nada', async () => {
    const h = harness()
    const other = '77777777-7777-4777-8777-777777777777'
    await runAssignment(apiWith(() => Promise.resolve(operation('APPLIED', { envioId: other }))), intent, new AbortController().signal, h.emit, h.wait)
    expect(h.views[h.views.length - 1]?.phase).toBe('failed')
  })

  it('timeout visual: queda demorado, con una sola solicitud y espera acotada', async () => {
    const h = harness()
    let posts = 0
    const api = apiWith(
      () => Promise.resolve(operation('PENDING')),
      () => {
        posts += 1
        return Promise.resolve({ status: 202, data: operation('PENDING') })
      },
    )
    await runAssignment(api, intent, new AbortController().signal, h.emit, h.wait)
    expect(h.views[h.views.length - 1]?.phase).toBe('delayed')
    expect(posts).toBe(1)
    expect(h.waits.reduce((sum, ms) => sum + ms, 0)).toBeLessThanOrEqual(VISUAL_TIMEOUT_MS)
  })

  it('consulta manual: sigue demorado si está pendiente y confirma si ya se aplicó', async () => {
    const still = harness()
    await refreshOperation(apiWith(() => Promise.resolve(operation('PENDING'))), pending(), new AbortController().signal, still.emit)
    expect(still.phases()).toEqual(['delayed'])
    const done = harness()
    await refreshOperation(apiWith(() => Promise.resolve(operation('APPLIED'))), pending(), new AbortController().signal, done.emit)
    expect(done.phases()).toEqual(['confirmed'])
  })

  it('una falla de consulta manual conserva el seguimiento', async () => {
    const h = harness()
    await refreshOperation(apiWith(() => Promise.reject(new RequestError('network'))), pending(), new AbortController().signal, h.emit)
    expect(h.views[0]).toMatchObject({ phase: 'delayed', checkFailed: true })
  })

  it('una falla transitoria de consulta no cancela el seguimiento', async () => {
    const h = harness()
    let reads = 0
    const api = apiWith(() => {
      reads += 1
      return reads < 3 ? Promise.reject(new RequestError('network')) : Promise.resolve(operation('APPLIED'))
    })
    await runAssignment(api, intent, new AbortController().signal, h.emit, h.wait)
    expect(h.views[h.views.length - 1]?.phase).toBe('confirmed')
    expect(reads).toBe(3)
  })

  it('sesión terminada: abortar durante la consulta descarta la respuesta tardía', async () => {
    const h = harness()
    const controller = new AbortController()
    const api = apiWith(() => {
      controller.abort()
      return Promise.resolve(operation('APPLIED'))
    })
    await runAssignment(api, intent, controller.signal, h.emit, h.wait)
    expect(h.phases()).toEqual(['requesting', 'requested'])
  })

  it('abortar antes de la respuesta del POST no emite estados posteriores', async () => {
    const h = harness()
    const controller = new AbortController()
    const api = apiWith(
      () => Promise.resolve(operation('APPLIED')),
      () => {
        controller.abort()
        return Promise.resolve({ status: 202, data: operation('PENDING') })
      },
    )
    await runAssignment(api, intent, controller.signal, h.emit, h.wait)
    expect(h.phases()).toEqual(['requesting'])
  })

  it('clasifica los errores del POST', async () => {
    const cases: Array<[() => Promise<{ status: number; data: unknown }>, string]> = [
      [() => Promise.reject(new RequestError('network')), 'uncertain'],
      [() => Promise.reject(new HttpError(502)), 'uncertain'],
      [() => Promise.reject(new HttpError(503)), 'failed'],
      [() => Promise.reject(new HttpError(409)), 'failed'],
      [() => Promise.resolve({ status: 200, data: operation('PENDING') }), 'uncertain'],
      [() => Promise.resolve({ status: 202, data: { roto: true } }), 'uncertain'],
    ]
    for (const [request, expected] of cases) {
      const h = harness()
      await runAssignment(apiWith(() => Promise.resolve(operation('PENDING')), request), intent, new AbortController().signal, h.emit, h.wait)
      expect(h.views[h.views.length - 1]?.phase).toBe(expected)
    }
  })

  it('parseOperation descarta estados desconocidos y acepta los válidos', () => {
    expect(parseOperation(operation('PENDING'))?.status).toBe('PENDING')
    expect(parseOperation(operation('LO_QUE_SEA'))).toBeNull()
    expect(parseOperation(null)).toBeNull()
  })
})
