import { useState } from 'react'
import type { FormEvent } from 'react'
import axios from 'axios'
import { authApi, courierApi, shipmentsApi } from '../api/services'
import { PendingConfirmation, readableError } from '../api/errors'
import { useNotify } from '../components/Notifications'
import { Badge, CopyText, PageTitle, Section } from '../components/UI'
import { uuidValid } from '../utils/format'
import type { Role } from '../types'

type Flow = {
  usuarioId?:string; repartidorId?:string; courierLinked:boolean; shipmentLinked:boolean;
  uncertain?:string; note?:string
}
const initial:Flow={courierLinked:false,shipmentLinked:false}
export function Admin(){
  const notify=useNotify();const [flow,setFlow]=useState<Flow>(initial);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [role,setRole]=useState<Role>('REPARTIDOR')
  const [clientId,setClientId]=useState('');const [clientUserId,setClientUserId]=useState('');const [clientUncertain,setClientUncertain]=useState(false)
  const errorWithUnknown=(err:unknown,step:string)=>{
    setError(readableError(err))
    if(err instanceof PendingConfirmation||(axios.isAxiosError(err)&&!err.response))setFlow(prev=>({...prev,uncertain:step,note:'El servidor pudo haber confirmado la operación. Reconciliá antes de repetir.'}))
  }
  const createAccount=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(busy||flow.usuarioId||flow.uncertain)return
    const f=e.currentTarget;const fd=new FormData(f);const pwd=String(fd.get('password')||'')
    if(new TextEncoder().encode(pwd).length>72){setError('Máximo 72 bytes UTF-8 para la contraseña.');return}
    setBusy(true);setError('')
    try{const r=await authApi.createUser({email:String(fd.get('email')||''),password:pwd,rol:role});if(!r.id)throw new PendingConfirmation();setFlow(prev=>({...prev,usuarioId:r.id,note:`Cuenta ${role} confirmada.`}));notify.success('Cuenta creada por Security.')}catch(err){errorWithUnknown(err,'Crear cuenta')}finally{f.reset();setBusy(false)}
  }
  const createCourier=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(busy||flow.repartidorId||flow.uncertain||!flow.usuarioId||role!=='REPARTIDOR')return
    const f=e.currentTarget;const fd=new FormData(f);setBusy(true);setError('')
    try{const r=await courierApi.create(String(fd.get('nombre')),String(fd.get('tipoVehiculo')));if(r.status===202||!r.data.id)throw new PendingConfirmation();setFlow(prev=>({...prev,repartidorId:r.data.id,note:'Repartidor creado; falta vincular su usuario.'}));notify.success('Repartidor creado por Courier.')}catch(err){errorWithUnknown(err,'Crear repartidor')}finally{setBusy(false)}
  }
  const linkCourier=async()=>{if(busy||flow.uncertain||flow.courierLinked||!flow.usuarioId||!flow.repartidorId)return;setBusy(true);setError('')
    try{const r=await courierApi.associate(flow.repartidorId,flow.usuarioId);if(r.status===202)throw new PendingConfirmation();const check=await courierApi.identity(flow.repartidorId);if(check.usuarioId!==flow.usuarioId)throw new PendingConfirmation();setFlow(prev=>({...prev,courierLinked:true,note:'Vínculo confirmado mediante lectura de Courier.'}));notify.success('Identidad asociada en Courier.')}catch(err){errorWithUnknown(err,'Vincular en Courier')}finally{setBusy(false)}
  }
  const linkShipment=async()=>{if(busy||flow.uncertain||flow.shipmentLinked||!flow.courierLinked||!flow.usuarioId||!flow.repartidorId)return;setBusy(true);setError('')
    try{const result=await shipmentsApi.associateCourier(flow.repartidorId,flow.usuarioId);if(result.status===202)throw new PendingConfirmation();setFlow(prev=>({...prev,shipmentLinked:true,note:'Shipment confirmó la asociación.'}));notify.success('Asociación registrada en Shipment.')}catch(err){errorWithUnknown(err,'Registrar asociación en Shipment')}finally{setBusy(false)}
  }
  const reconcile=async()=>{if(busy||!flow.usuarioId)return;setBusy(true);setError('')
    try{await authApi.user(flow.usuarioId);if(flow.repartidorId){await courierApi.one(flow.repartidorId);const check=await courierApi.identity(flow.repartidorId);setFlow(prev=>({...prev,courierLinked:check.usuarioId===prev.usuarioId,uncertain:prev.uncertain==='Vincular en Courier'&&check.usuarioId===prev.usuarioId?undefined:prev.uncertain,note:'Lecturas de Security y Courier confirmadas. Shipment no ofrece consulta explícita de asociación; no se infiere.'}))}else setFlow(prev=>({...prev,note:'La cuenta está confirmada en Security.'}));notify.info('Reconciliación de solo lectura realizada.')}catch(err){setError(readableError(err))}finally{setBusy(false)}
  }
  const attachClient=async()=>{if(busy||clientUncertain||!uuidValid(clientId)||!uuidValid(clientUserId))return;setBusy(true);setError('')
    try{await authApi.user(clientUserId);const result=await shipmentsApi.associateCustomer(clientId,clientUserId);if(result.status===202)throw new PendingConfirmation();notify.success('Shipment confirmó la vinculación del cliente.')}catch(err){setError(readableError(err));if(err instanceof PendingConfirmation||(axios.isAxiosError(err)&&!err.response))setClientUncertain(true)}finally{setBusy(false)}
  }
  const steps=[{id:'1',title:'Crear cuenta',done:!!flow.usuarioId},{id:'2',title:'Crear repartidor',done:!!flow.repartidorId},{id:'3',title:'Vincular Courier',done:flow.courierLinked},{id:'4',title:'Registrar en Shipment',done:flow.shipmentLinked}]
  return <><PageTitle eyebrow="ADMINISTRACIÓN / IDENTIDADES" title="Centro de administración" description="Coordiná altas y asociaciones entre Security, Courier y Shipment sin asumir una transacción distribuida."/>
    <div className="warning-box subtle">Este flujo mantiene únicamente identificadores y confirmaciones en memoria. Las credenciales nunca se guardan en los pasos; ante una respuesta perdida no repetimos POST automáticamente. El diagnóstico técnico ADMIN se prueba por API.</div>
    <div className="step-grid">{steps.map(x=><div className={`step-item ${x.done?'step-done':''}`} key={x.id}><span>{x.done?'✓':x.id}</span><div><small>PASO {x.id}</small><strong>{x.title}</strong></div></div>)}</div>
    <div className="two-col"><Section title="01. Crear identidad" description="Security: POST /api/v1/usuarios (solo ADMIN)."><form onSubmit={createAccount} className="form-stacked"><label>Correo electrónico<input type="email" name="email" required placeholder="usuario@ejemplo.com" disabled={busy||!!flow.usuarioId}/></label><label>Contraseña inicial<input type="password" name="password" autoComplete="new-password" minLength={12} maxLength={72} required placeholder="12 a 72 caracteres" disabled={busy||!!flow.usuarioId}/></label><label>Rol<select value={role} onChange={e=>setRole(e.target.value as Role)} disabled={busy||!!flow.usuarioId}><option value="REPARTIDOR">REPARTIDOR</option><option value="CLIENTE">CLIENTE</option><option value="ADMIN">ADMIN</option></select></label><button disabled={busy||!!flow.usuarioId||!!flow.uncertain} className="btn btn-primary">{flow.usuarioId?'Cuenta confirmada ✓':'Crear cuenta'}</button></form>{flow.usuarioId&&<div className="confirmed-id"><strong>ID de usuario</strong><CopyText text={flow.usuarioId}/></div>}</Section>
      <Section title="02. Crear recurso Courier" description="Para una cuenta REPARTIDOR, registrá su recurso de dominio."><form onSubmit={createCourier} className="form-stacked"><label>Nombre<input name="nombre" required placeholder="Nombre del repartidor" disabled={busy||!flow.usuarioId||!!flow.repartidorId||role!=='REPARTIDOR'}/></label><label>Tipo de vehículo<input name="tipoVehiculo" required placeholder="Moto" disabled={busy||!flow.usuarioId||!!flow.repartidorId||role!=='REPARTIDOR'}/></label><button className="btn btn-primary" disabled={busy||!flow.usuarioId||!!flow.repartidorId||!!flow.uncertain||role!=='REPARTIDOR'}>{flow.repartidorId?'Recurso confirmado ✓':'Crear repartidor'}</button></form>{flow.repartidorId&&<div className="confirmed-id"><strong>ID del repartidor</strong><CopyText text={flow.repartidorId}/></div>}</Section></div>
    <div className="two-col"><Section title="03. Vincular en Courier" description="PUT /api/v1/repartidores/{id}/usuario; confirmación mediante GET posterior."><div className="flow-summary"><div><span>Usuario</span><CopyText text={flow.usuarioId}/></div><div><span>Repartidor</span><CopyText text={flow.repartidorId}/></div><div><span>Estado</span>{flow.courierLinked?<Badge value="ACTIVO"/>:<strong>Pendiente</strong>}</div></div><button className="btn btn-primary" disabled={busy||!flow.usuarioId||!flow.repartidorId||flow.courierLinked||!!flow.uncertain} onClick={()=>void linkCourier()}>{flow.courierLinked?'Vínculo verificado ✓':'Vincular identidad'}</button></Section>
      <Section title="04. Registrar en Shipment" description="PUT /api/v1/asociaciones/repartidores/{id}."><p className="muted">Registrá la asociación después de confirmar el vínculo en Courier. La aceptación final requiere validación de backend.</p><button className="btn btn-primary" disabled={busy||!flow.courierLinked||flow.shipmentLinked||!!flow.uncertain} onClick={()=>void linkShipment()}>{flow.shipmentLinked?'Asociación confirmada ✓':'Registrar asociación'}</button>{flow.shipmentLinked&&<p className="success-message">✓ Flujo administrativo completado según respuestas confirmadas.</p>}</Section></div>
    {flow.note&&<div className="info-box">{flow.note}</div>}{error&&<div className="inline-error" role="alert">{error}</div>}{flow.uncertain&&<div className="warning-box"><strong>Resultado incierto en: {flow.uncertain}.</strong> No se habilitará un nuevo intento de escritura a ciegas. Si se trató de un POST sin ID confirmado, reconciliá con el equipo o la base autorizada. Si fue una asociación de Shipment, la API actual no permite confirmar directamente el vínculo; requiere verificación externa.</div>}
    <div className="button-row bottom-toolbar"><button className="btn btn-outline" disabled={busy||!flow.usuarioId} onClick={()=>void reconcile()}>↻ Reconciliar lecturas conocidas</button><button className="btn btn-danger-outline" onClick={()=>{if(window.confirm('¿Limpiar IDs y progreso local? No elimina nada del backend.')){setFlow(initial);setError('');setRole('REPARTIDOR')}}}>Limpiar flujo local</button></div>
    <Section title="Asociación opcional de cliente" description="Vinculá un cliente local existente con una cuenta de rol CLIENTE. Ambos UUID deben haber sido confirmados."><div className="form-inline"><label>ID del cliente local<input value={clientId} onChange={e=>setClientId(e.target.value)} placeholder="clienteId (Shipment)"/></label><label>ID de usuario CLIENTE<input value={clientUserId} onChange={e=>setClientUserId(e.target.value)} placeholder="usuarioId (Security)"/></label><button className="btn btn-outline" disabled={busy||clientUncertain||!uuidValid(clientId)||!uuidValid(clientUserId)} onClick={()=>void attachClient()}>Vincular cliente</button></div>{clientUncertain&&<div className="warning-box">Resultado incierto. Consultá con el equipo antes de reintentar; no existe una lectura de asociación específica en el contrato actual.</div>}</Section>
  </>
}
