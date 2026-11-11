import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../../shared/components/Button'
import { RequestErrorNotice } from '../../shared/components/RequestErrorNotice'
import { HttpError, RequestError } from '../../shared/http/httpError'
import { shipmentFromForm } from './validation'
import type { Envio } from './types'
import type { ShipmentService } from './services/shipmentService'
import styles from './ShipmentsPage.module.css'

/** Alta sin identidad seleccionable, con bloqueo inmediato de doble envío y resultado incierto. */
export function ShipmentCreate({ service, onCreated, onRefresh }: { service: ShipmentService; onCreated: (envio: Envio) => void; onRefresh: () => void }) {
  const pending = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [validation, setValidation] = useState('')
  const [uncertain, setUncertain] = useState(false)
  useEffect(() => () => { pending.current?.abort() }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || uncertain) return
    const form = event.currentTarget
    let body
    try { body = shipmentFromForm(new FormData(form)) } catch (cause) {
      setValidation(cause instanceof Error ? cause.message : 'Revisá los datos.')
      return
    }
    const controller = new AbortController()
    pending.current = controller
    setBusy(true); setError(null); setValidation('')
    try {
      const envio = await service.create(body, controller.signal)
      if (controller.signal.aborted) return
      form.reset()
      onCreated(envio)
    } catch (cause) {
      if (controller.signal.aborted) return
      setError(cause)
      if ((cause instanceof RequestError && ['network', 'response'].includes(cause.code)) || (cause instanceof HttpError && cause.status >= 500)) {
        setUncertain(true)
        onRefresh()
      }
    } finally {
      if (pending.current === controller) pending.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return <section className={styles.card} aria-labelledby="create-title">
    <h2 id="create-title">Registrar envío</h2>
    <p>Las medidas usan punto decimal. Peso: hasta 7 enteros y 3 decimales; dimensiones: hasta 8 enteros y 2 decimales.</p>
    {validation && <p role="alert">{validation}</p>}
    {error !== null && <RequestErrorNotice error={error} />}
    {uncertain && <div role="alert">
      <p>El alta no está confirmada. Revisá el listado antes de volver a crear: repetir podría duplicar el envío.</p>
      <Button onClick={() => { setUncertain(false); setError(null) }}>Revisé el listado; iniciar otra alta</Button>
    </div>}
    <form onSubmit={submit} aria-busy={busy} className={styles.form}>
      <fieldset disabled={busy || uncertain}>
        <legend>Contacto del cliente</legend>
        <label>Nombre<input name="nombre" required /></label>
        <label>Correo del cliente<input name="email" type="email" required /></label>
        <label>Teléfono (opcional)<input name="telefono" type="tel" /></label>
      </fieldset>
      {(['origen', 'destino'] as const).map((prefix) => <fieldset disabled={busy || uncertain} key={prefix}>
        <legend>{prefix === 'origen' ? 'Origen' : 'Destino'}</legend>
        {([['calle', 'Calle'], ['numero', 'Número'], ['ciudad', 'Ciudad'], ['codigoPostal', 'Código postal']] as const).map(([key, label]) =>
          <label key={key}>{label} de {prefix}<input name={`${prefix}.${key}`} required /></label>)}
      </fieldset>)}
      <fieldset disabled={busy || uncertain}>
        <legend>Medidas</legend>
        {([['pesoKg', 'Peso (kg)'], ['anchoCm', 'Ancho (cm)'], ['altoCm', 'Alto (cm)'], ['largoCm', 'Largo (cm)']] as const).map(([key, label]) =>
          <label key={key}>{label}<input name={key} inputMode="decimal" required /></label>)}
      </fieldset>
      <Button type="submit" disabled={busy || uncertain}>{busy ? 'Registrando…' : 'Registrar envío'}</Button>
    </form>
  </section>
}
