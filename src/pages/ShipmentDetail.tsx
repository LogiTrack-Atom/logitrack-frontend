import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import { shipmentsApi } from '../api/services'
import { useAuth } from '../auth/AuthProvider'
import { isCurrentGeneration, sessionGeneration } from '../auth/session'
import { PendingConfirmation, readableError } from '../api/errors'
import { useNotify } from '../components/Notifications'
import { Badge, CopyText, ErrorPanel, Loading, PageTitle, Section } from '../components/UI'
import { addressText, dateText, uuidValid } from '../utils/format'
import type { Shipment, ShipmentEvent, ShipmentStatus } from '../types'

export function ShipmentDetail(){
  const {id=''}=useParams();const {hasRole}=useAuth();const notify=useNotify()
  const [item,setItem]=useState<Shipment|null>(null);const [history,setHistory]=useState<ShipmentEvent[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [assignee,setAssignee]=useState('');const [pending,setPending]=useState(false)
  const load=useCallback(async()=>{const gen=sessionGeneration();setLoading(true);setError('');try{const [data,events]=await Promise.all([shipmentsApi.one(id),shipmentsApi.history(id)]);if(isCurrentGeneration(gen)){setItem(data);setHistory(events)}}catch(err){if(isCurrentGeneration(gen))setError(readableError(err))}finally{if(isCurrentGeneration(gen))setLoading(false)}},[id])
  useEffect(()=>{void load()},[load])
  const mutate=async(kind:'assign'|'state'|'cancel',value?:ShipmentStatus)=>{
    if(busy||pending||!item)return
    if(kind==='assign'&&!uuidValid(assignee)){setError('Ingresá un UUID válido de repartidor.');return}
    setBusy(true);setError('')
    try{
      const response=kind==='assign'?await shipmentsApi.assign(id,assignee.trim()):kind==='cancel'?await shipmentsApi.cancel(id):await shipmentsApi.state(id,value!)
      if(response.status===202)throw new PendingConfirmation()
      const confirmed=await shipmentsApi.one(id)
      const expected=kind==='assign'?confirmed.repartidorId===assignee.trim():kind==='cancel'?confirmed.estado==='CANCELADO':confirmed.estado===value
      if(!expected){setError('La lectura posterior todavía no confirmó el cambio. Revisá el envío antes de actuar de nuevo.');return}
      setItem(confirmed);setHistory(await shipmentsApi.history(id));notify.success('Cambio confirmado en el backend.')
    }catch(err){setError(readableError(err));if(err instanceof PendingConfirmation||(axios.isAxiosError(err)&&!err.response)){setPending(true)}}finally{setBusy(false)}
  }
  return <><PageTitle eyebrow="ENVÍOS / DETALLE" title="Detalle del envío" description="Información y trazabilidad de una operación autorizada." actions={<div className="button-row"><Link to="/envios" className="btn btn-outline">← Listado</Link><button className="btn btn-outline" onClick={()=>void load()}>↻ Consultar</button></div>}/>
    {loading?<Loading/>:error&&!item?<ErrorPanel message={error} onRetry={()=>void load()}/>:!item?<ErrorPanel message="No hay datos del envío."/>:<>
      <div className="detail-header panel"><div><small className="eyebrow">CÓDIGO DE SEGUIMIENTO</small><h2>{item.codigoSeguimiento}</h2><div className="muted"><CopyText text={item.id}/></div></div><Badge value={item.estado}/></div>
      <div className="two-col"><Section title="Información del paquete"><div className="detail-list"><div><span>Cliente</span><strong>{item.cliente?.nombre}</strong></div><div><span>Correo</span><strong>{item.cliente?.email}</strong></div><div><span>Peso</span><strong>{item.pesoKg} kg</strong></div><div><span>Medidas</span><strong>{item.anchoCm} × {item.altoCm} × {item.largoCm} cm</strong></div><div><span>Repartidor</span><CopyText text={item.repartidorId}/></div><div><span>Última actualización</span><strong>{dateText(item.updatedAt)}</strong></div></div></Section>
        <Section title="Ruta del envío"><div className="route-view"><span className="route-point route-start"/><div><small>ORIGEN</small><strong>{addressText(item.origen)}</strong><p>CP {item.origen?.codigoPostal}</p></div><div className="route-line"/><span className="route-point route-end"/><div><small>DESTINO</small><strong>{addressText(item.destino)}</strong><p>CP {item.destino?.codigoPostal}</p></div></div></Section></div>
      {hasRole('ADMIN')&&<Section title="Acciones de administración" description="La asignación solo es válida en PENDIENTE; no altera el estado ni el historial."><div className="form-inline"><label>UUID de repartidor<input value={assignee} onChange={e=>setAssignee(e.target.value)} placeholder="xxxxxxxx-xxxx-..." disabled={busy||item.estado!=='PENDIENTE'}/></label><button className="btn btn-primary" disabled={busy||pending||item.estado!=='PENDIENTE'} onClick={()=>void mutate('assign')}>Asignar y verificar</button><button className="btn btn-danger-outline" disabled={busy||pending||item.estado!=='PENDIENTE'} onClick={()=>{if(window.confirm('¿Cancelar este envío pendiente?'))void mutate('cancel')}}>Cancelar envío</button></div></Section>}
      {hasRole('REPARTIDOR')&&<Section title="Actualizar el estado" description="Los permisos y la asignación son verificados nuevamente por Shipment."><div className="button-row"><button className="btn btn-primary" disabled={busy||pending||item.estado!=='PENDIENTE'} onClick={()=>void mutate('state','EN_RUTA')}>Iniciar recorrido</button><button className="btn btn-primary" disabled={busy||pending||item.estado!=='EN_RUTA'} onClick={()=>void mutate('state','ENTREGADO')}>Confirmar entrega</button></div></Section>}
      {error&&<div className="inline-error" role="alert">{error}</div>}{pending&&<div className="warning-box"><strong>Resultado no confirmado.</strong> No repetiremos el intento. Consultá el estado con «Consultar» y reconciliá el resultado antes de cualquier otra escritura. La ampliación asíncrona requiere un contrato de operación confirmado.</div>}
      <Section title="Historial de estados" description={`${history.length} evento(s) persistido(s). Asignar repartidor no crea un evento.`}><div className="timeline">{history.map(x=><div className="timeline-event" key={x.id}><div className="timeline-marker"/><div><strong>{x.estadoAnterior||'CREACIÓN'} → {x.estadoNuevo}</strong><p>{dateText(x.fechaCambio)}</p></div></div>)}{history.length===0&&<p className="muted">Sin eventos visibles.</p>}</div></Section>
    </>}
  </>
}
