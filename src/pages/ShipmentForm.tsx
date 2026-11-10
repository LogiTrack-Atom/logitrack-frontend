import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { shipmentsApi } from '../api/services'
import { PendingConfirmation, UncertainResult, readableError } from '../api/errors'
import { useNotify } from '../components/Notifications'
import { PageTitle, Section } from '../components/UI'
import type { Address, ShipmentCreate } from '../types'

const address=(form:FormData,prefix:string):Address=>({calle:String(form.get(`${prefix}.calle`)||'').trim(),numero:String(form.get(`${prefix}.numero`)||'').trim(),ciudad:String(form.get(`${prefix}.ciudad`)||'').trim(),codigoPostal:String(form.get(`${prefix}.codigoPostal`)||'').trim()})
function AddressFields({prefix,title}: {prefix:'origen'|'destino';title:string}) {return <fieldset className="fieldset"><legend>{title}</legend><div className="form-grid"><label>Calle<input name={`${prefix}.calle`} required maxLength={150} placeholder="Belgrano"/></label><label>Número<input name={`${prefix}.numero`} required placeholder="100"/></label><label>Ciudad<input name={`${prefix}.ciudad`} required placeholder="San Salvador de Jujuy"/></label><label>Código postal<input name={`${prefix}.codigoPostal`} required placeholder="4600"/></label></div></fieldset>}
export function ShipmentForm(){
  const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [uncertain,setUncertain]=useState(false);const navigate=useNavigate();const notify=useNotify()
  const submit=async(ev:FormEvent<HTMLFormElement>)=>{ev.preventDefault();if(busy||uncertain)return
    const form=new FormData(ev.currentTarget)
    const quantity=(key:string)=>Number(form.get(key))
    const input:ShipmentCreate={cliente:{nombre:String(form.get('nombre')||'').trim(),email:String(form.get('email')||'').trim(),telefono:String(form.get('telefono')||'').trim()||null},origen:address(form,'origen'),destino:address(form,'destino'),pesoKg:quantity('pesoKg'),anchoCm:quantity('anchoCm'),altoCm:quantity('altoCm'),largoCm:quantity('largoCm')}
    if([input.pesoKg,input.anchoCm,input.altoCm,input.largoCm].some(v=>!Number.isFinite(v)||v<=0)){setError('Todas las medidas deben ser positivas.');return}
    setBusy(true);setError('')
    try{const response=await shipmentsApi.create(input);if(response.status===202)throw new PendingConfirmation();if(!response.data?.id)throw new UncertainResult();notify.success('El envío fue registrado.');navigate(`/envios/${response.data.id}`,{replace:true})}
    catch(err){setError(readableError(err));if(err instanceof PendingConfirmation||err instanceof UncertainResult||(axios.isAxiosError(err)&&!err.response))setUncertain(true)}finally{setBusy(false)}
  }
  return <><PageTitle eyebrow="ENVÍOS / ALTA" title="Registrar un nuevo envío" description="Completá la información de contacto, recorrido y dimensiones del paquete." actions={<Link to="/envios" className="btn btn-outline">← Volver</Link>}/>
    <form onSubmit={submit} className="form-flow"><Section title="01. Datos de contacto" description="El backend determina la identidad de la cuenta a partir del JWT; el correo no reemplaza la autorización."><div className="form-grid"><label>Nombre completo<input name="nombre" required placeholder="Nombre del destinatario"/></label><label>Correo electrónico<input type="email" name="email" required placeholder="cliente@ejemplo.com"/></label><label>Teléfono (opcional)<input name="telefono" placeholder="388..."/></label></div></Section>
      <Section title="02. Recorrido" description="Indicá el punto de origen y el destino final."><div className="address-pair"><AddressFields prefix="origen" title="Origen"/><AddressFields prefix="destino" title="Destino"/></div></Section>
      <Section title="03. Dimensiones" description="Todos los valores deben ser mayores a cero; peso hasta 3 decimales y dimensiones hasta 2."><div className="form-grid columns-four"><label>Peso (kg)<input name="pesoKg" type="number" min="0.001" step="0.001" required defaultValue="1.250"/></label><label>Ancho (cm)<input name="anchoCm" type="number" min="0.01" step="0.01" required defaultValue="25.25"/></label><label>Alto (cm)<input name="altoCm" type="number" min="0.01" step="0.01" required defaultValue="15.50"/></label><label>Largo (cm)<input name="largoCm" type="number" min="0.01" step="0.01" required defaultValue="30.75"/></label></div></Section>
      {error&&<div className="inline-error" role="alert">{error}</div>}{uncertain&&<div className="warning-box">El resultado de la creación es incierto. No vuelvas a enviar automáticamente: verificá con un administrador si el envío se creó antes de intentar otra alta.</div>}
      <div className="form-actions"><Link to="/envios" className="btn btn-outline">Cancelar</Link><button type="submit" className="btn btn-primary" disabled={busy||uncertain}>{busy?'Registrando...':'Registrar envío →'}</button></div>
    </form></>
}
