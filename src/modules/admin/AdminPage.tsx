import { useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import { PageHeader } from '../../shared/components/PageHeader'
import { Button } from '../../shared/components/Button'
import type { Rol } from '../auth/types'
import { ROLES } from '../auth/types'
import { useAdminFlow } from './useAdminFlow'
import type { AdminStep } from './adminFlow'
import type { AdminFlowStore } from './adminFlow'
import styles from './AdminPage.module.css'

export function AdminPage() { return <AdminWorkspace flow={useAdminFlow()} /> }

/** Adapta el flujo por pasos de JMatiasF (e6622af) sin almacenar credenciales en el progreso. */
export function AdminWorkspace({ flow }: { flow: AdminFlowStore }) {
  const state = useSyncExternalStore(flow.subscribe, flow.getSnapshot)
  const [confirmReset, setConfirmReset] = useState(false)
  const stepNames: Record<AdminStep, string> = { user: 'alta de cuenta', courier: 'alta de ficha Courier', courierLink: 'vínculo Courier', shipmentLink: 'referencia Shipment', clientLink: 'vínculo del cliente' }
  const locked = state.busy || state.uncertain !== null
  const postUserLocked = locked || state.userId !== null
  const courierStep = state.role === 'REPARTIDOR'
  function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget, fields = new FormData(form)
    const data = { email: String(fields.get('email') ?? ''), password: String(fields.get('password') ?? ''), rol: String(fields.get('rol')) as Rol }
    const passwordInput = form.elements.namedItem('password') as HTMLInputElement
    passwordInput.value = ''
    void flow.createUser(data)
  }
  function createCourier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    void flow.createCourier({ nombre: String(fields.get('nombre') ?? ''), tipoVehiculo: String(fields.get('tipoVehiculo') ?? '') })
  }
  function recover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    void flow.recover(String(fields.get('userId') ?? '').trim(), String(fields.get('courierId') ?? '').trim())
  }
  function linkClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const fields = new FormData(event.currentTarget)
    void flow.linkClient(String(fields.get('clientId') ?? '').trim(), String(fields.get('clientUserId') ?? '').trim())
  }
  const steps = [
    ['Cuenta', state.userConfirmed],
    ...(courierStep ? [['Ficha Courier', state.courierConfirmed], ['Vínculo Courier', state.courierLinked], ['Referencia Shipment', state.shipmentLinked]] : []),
  ]
  return <div className={styles.workspace}>
    <PageHeader title="Administración" description="Creá cuentas y vinculalas a sus fichas de operación." />
    <ol aria-label="Progreso administrativo" className={styles.steps}>{steps.map(([name, done]) => <li key={String(name)} data-confirmed={Boolean(done)}>{name}: {done ? 'confirmado' : 'pendiente'}</li>)}</ol>
    {state.error && <p role="alert">{state.error}</p>}
    {state.note && <p role="status">{state.note}</p>}
    {state.uncertain && <div role="alert" className={styles.card}>
      <strong>Resultado incierto en: {stepNames[state.uncertain]}.</strong>
      <p>No se repiten altas POST. Si falta el ID, recuperalo mediante una verificación externa autorizada y validalo abajo. Conocer un correo no permite buscar una cuenta por una API inexistente.</p>
      {['shipmentLink', 'clientLink'].includes(state.uncertain) && <p>No existe GET de esa asociación. Revalidar lecturas no confirma Shipment. Solo podés repetir explícitamente el mismo PUT inmutable con los mismos IDs, que se vuelven a validar.</p>}
    </div>}
    <section className={styles.card} aria-labelledby="account-title">
      <h2 id="account-title">1. Crear identidad</h2>
      <form onSubmit={createUser} className={styles.form} aria-busy={state.busy}>
        <fieldset disabled={postUserLocked}>
          <legend>Cuenta nueva</legend>
          <label>Correo de la nueva cuenta<input name="email" type="email" maxLength={254} required /></label>
          <label>Contraseña inicial<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={72} required /></label>
          <label>Rol de la cuenta<select name="rol" defaultValue="REPARTIDOR">{ROLES.map((role) => <option key={role}>{role}</option>)}</select></label>
          <Button type="submit" disabled={postUserLocked}>Crear cuenta</Button>
        </fieldset>
      </form>
      {state.userEmail && <p>Cuenta del flujo: {state.userEmail}</p>}
      {state.userId && <p>usuarioId: <code data-testid="confirmed-user-id">{state.userId}</code> — {state.userConfirmed ? 'lectura confirmada' : 'ID recibido; falta confirmar lectura'}</p>}
      {state.userConfirmed && !courierStep && <p>La cuenta {state.role} no requiere una ficha Courier.</p>}
    </section>
    <section className={styles.card} aria-labelledby="resource-title">
      <h2 id="resource-title">2. Crear ficha Courier</h2>
      <form onSubmit={createCourier} className={styles.form}>
        <fieldset disabled={locked || !state.userConfirmed || !courierStep || state.courierId !== null}>
          <legend>Recurso del repartidor</legend>
          <label>Nombre del repartidor<input name="nombre" required maxLength={255} /></label>
          <label>Vehículo del repartidor<input name="tipoVehiculo" required maxLength={255} /></label>
          <Button type="submit">Crear ficha Courier</Button>
        </fieldset>
      </form>
      {state.courierId && <p>repartidorId: <code data-testid="confirmed-courier-id">{state.courierId}</code> — {state.courierConfirmed ? 'lectura confirmada' : 'ID recibido; falta confirmar lectura'}</p>}
    </section>
    <section className={styles.card} aria-labelledby="links-title">
      <h2 id="links-title">3 y 4. Confirmar vínculos</h2>
      <p>Se verifica la cuenta, la ficha y su identidad antes de registrar la referencia. Una escritura no revierte automáticamente las anteriores.</p>
      <div className={styles.toolbar}>
        <Button disabled={state.busy || !state.userConfirmed || !state.courierConfirmed || state.courierLinked || state.uncertain !== null && state.uncertain !== 'courierLink'} onClick={() => void flow.linkCourier()}>Verificar y vincular Courier</Button>
        <Button disabled={state.busy || !state.courierLinked || state.shipmentLinked || state.uncertain !== null && state.uncertain !== 'shipmentLink'} onClick={() => void flow.linkShipment()}>{state.uncertain === 'shipmentLink' ? 'Revalidar y repetir el mismo vínculo Shipment' : 'Registrar referencia Shipment'}</Button>
        <Button variant="secondary" disabled={state.busy || !state.userId} onClick={() => void flow.reconcile()}>Revalidar lecturas conocidas</Button>
      </div>
    </section>
    <section className={styles.card} aria-labelledby="recover-title">
      <h2 id="recover-title">Recuperar IDs confirmados externamente</h2>
      <p>Después de cerrar sesión, recuperá los IDs y volvé a comprobar permisos y recursos. No se infieren asociaciones no consultables.</p>
      <form key={`${state.userId}:${state.courierId}`} onSubmit={recover} className={styles.form}>
        <fieldset disabled={state.busy}>
          <legend>Recuperación por lectura</legend>
          <label>usuarioId a recuperar<input name="userId" defaultValue={state.userId ?? ''} required /></label>
          <label>repartidorId a recuperar (opcional)<input name="courierId" defaultValue={state.courierId ?? ''} /></label>
          <Button type="submit">Validar y recuperar IDs</Button>
        </fieldset>
      </form>
    </section>
    <section className={styles.card} aria-labelledby="client-title">
      <h2 id="client-title">Asociación opcional de cliente</h2>
      <p>Usá el ID local del cliente y una cuenta CLIENTE confirmada. No se reemplaza una asociación de otra identidad.</p>
      <form key={`${state.clientId}:${state.clientUserId}`} onSubmit={linkClient} className={styles.form}>
        <fieldset disabled={state.busy || state.clientLinked || state.uncertain !== null && state.uncertain !== 'clientLink'}>
          <legend>Vínculo del cliente</legend>
          <label>clienteId local<input name="clientId" defaultValue={state.clientId ?? ''} required readOnly={state.uncertain === 'clientLink'} /></label>
          <label>usuarioId CLIENTE<input name="clientUserId" defaultValue={state.clientUserId ?? ''} required readOnly={state.uncertain === 'clientLink'} /></label>
          <Button type="submit">{state.uncertain === 'clientLink' ? 'Revalidar y repetir el mismo vínculo de cliente' : 'Vincular cliente'}</Button>
        </fieldset>
      </form>
      {state.clientLinked && <p role="status">Asociación del cliente confirmada.</p>}
    </section>
    <section className={styles.card}>
      <Button variant="secondary" disabled={state.busy} onClick={() => setConfirmReset(true)}>Limpiar progreso local</Button>
      {confirmReset && <div><p>Los recursos creados permanecen en los servicios. Conservá sus IDs antes de limpiar el progreso.</p><Button disabled={state.busy} onClick={() => { flow.reset(); setConfirmReset(false) }}>Confirmar limpieza local</Button>{' '}<Button variant="secondary" onClick={() => setConfirmReset(false)}>Conservar progreso</Button></div>}
    </section>
  </div>
}
