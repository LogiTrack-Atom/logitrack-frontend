import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { shipmentsApi } from '../api/services'
import { useAuth } from '../auth/AuthProvider'
import { isCurrentGeneration, sessionGeneration } from '../auth/session'
import { readableError } from '../api/errors'
import { Badge, Empty, ErrorPanel, Loading, PageTitle } from '../components/UI'
import { addressText, dateText, shortId } from '../utils/format'
import type { Shipment, ShipmentStatus } from '../types'

const statuses = ['','PENDIENTE','EN_RUTA','ENTREGADO','CANCELADO'] as const
export function Shipments(){
  const {hasRole}=useAuth();const navigate=useNavigate();const [tracking,setTracking]=useState('');const [trackingBusy,setTrackingBusy]=useState(false);const [filter,setFilter]=useState<ShipmentStatus|''>('');const [items,setItems]=useState<Shipment[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [query,setQuery]=useState('')
  const load=useCallback(async()=>{const gen=sessionGeneration();setLoading(true);setError('');try{const data=await shipmentsApi.list(filter);if(isCurrentGeneration(gen))setItems(data)}catch(err){if(isCurrentGeneration(gen))setError(readableError(err))}finally{if(isCurrentGeneration(gen))setLoading(false)}},[filter])
  useEffect(()=>{void load()},[load])
  const lookup=async()=>{if(!tracking.trim()||trackingBusy)return;setTrackingBusy(true);setError('');try{const result=await shipmentsApi.track(tracking.trim());navigate(`/envios/${result.id}`)}catch(err){setError(readableError(err))}finally{setTrackingBusy(false)}}
  const visible=items.filter(x=>`${x.codigoSeguimiento} ${x.id} ${x.cliente?.nombre||''} ${x.destino?.ciudad||''}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <><PageTitle eyebrow="OPERACIONES / SHIPMENT SERVICE" title="Gestión de envíos" description="Consultá el estado, la asignación y el historial de cada envío autorizado." actions={<div className="button-row"><button className="btn btn-outline" onClick={()=>void load()}>↻ Actualizar</button>{hasRole('ADMIN','CLIENTE')&&<Link className="btn btn-primary" to="/envios/nuevo">＋ Nuevo envío</Link>}</div>}/>
    <section className="panel"><div className="panel-heading row-between"><div><h2>Listado de envíos</h2><p>La API restringe automáticamente los resultados a tu identidad.</p></div><span className="count-tag">{visible.length} registros</span></div>
      <div className="filter-row"><label className="search-field"><span>⌕</span><input aria-label="Buscar envíos" placeholder="Buscar por seguimiento, ID o destino..." value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="filter-select">Estado <select value={filter} onChange={e=>setFilter(e.target.value as ShipmentStatus|'')}>{statuses.map(x=><option key={x} value={x}>{x?x.replaceAll('_',' '):'Todos los estados'}</option>)}</select></label></div>
      <div className="tracking-lookup"><label>Código de seguimiento <input value={tracking} onChange={e=>setTracking(e.target.value)} placeholder="Ingresá el código exacto"/></label><button className="btn btn-outline" onClick={()=>void lookup()} disabled={trackingBusy||!tracking.trim()}>{trackingBusy?'Consultando...':'Buscar seguimiento →'}</button></div>
      {loading?<Loading/>:error?<ErrorPanel message={error} onRetry={()=>void load()}/>:visible.length===0?<Empty title="No encontramos envíos" description="Cambiá los filtros o registrá un envío nuevo si tu rol lo permite."/>:<div className="table-wrap"><table><thead><tr><th>CÓDIGO</th><th>CLIENTE</th><th>RECORRIDO</th><th>ESTADO</th><th>REPARTIDOR</th><th>CREADO</th><th/></tr></thead><tbody>{visible.map(x=><tr key={x.id}><td><strong className="table-id">{x.codigoSeguimiento}</strong><small>{shortId(x.id)}</small></td><td>{x.cliente?.nombre||'—'}</td><td>{addressText(x.origen)}<span className="table-arrow"> → </span>{addressText(x.destino)}</td><td><Badge value={x.estado}/></td><td className="muted">{shortId(x.repartidorId)}</td><td className="muted">{dateText(x.createdAt)}</td><td><Link className="btn btn-small btn-outline" to={`/envios/${x.id}`}>Detalle →</Link></td></tr>)}</tbody></table></div>}
    </section><div className="footnote">La tabla no permite consultar envíos ajenos: el backend valida pertenencia y permisos en cada solicitud.</div></>
}
