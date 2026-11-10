import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { shipmentsApi, courierApi } from '../api/services'
import { readableError } from '../api/errors'
import { isCurrentGeneration, sessionGeneration } from '../auth/session'
import type { Courier, Shipment } from '../types'
import { Badge, Empty, Metric, NavTile, PageTitle } from '../components/UI'
import { dateText, shortId } from '../utils/format'

export function Dashboard(){
  const {user,hasRole}=useAuth();const [shipments,setShipments]=useState<Shipment[]>([]);const [couriers,setCouriers]=useState<Courier[]>([]);const [error,setError]=useState('');const [loading,setLoading]=useState(true)
  useEffect(()=>{const gen=sessionGeneration();let mounted=true
    void Promise.all([shipmentsApi.list(),hasRole('ADMIN')?courierApi.list():Promise.resolve([])]).then(([envios,repartidores])=>{if(mounted&&isCurrentGeneration(gen)){setShipments(envios);setCouriers(repartidores)}}).catch(e=>{if(mounted&&isCurrentGeneration(gen))setError(readableError(e))}).finally(()=>{if(mounted)setLoading(false)})
    return()=>{mounted=false}
  },[hasRole])
  const inProgress=shipments.filter(x=>x.estado==='EN_RUTA').length
  const delivered=shipments.filter(x=>x.estado==='ENTREGADO').length
  return <><PageTitle eyebrow="PANEL GENERAL / SPRINT 04" title={`¡Hola${user?.email?`, ${user.email.split('@')[0]}`:''}! 👋`} description="Este es tu centro de control. Consultá el estado de tus operaciones en tiempo real." actions={<span className="date-chip">◷ {new Intl.DateTimeFormat('es-AR',{dateStyle:'full'}).format(new Date())}</span>}/>
    <div className="welcome-banner"><div><div className="welcome-tag">✦ PLATAFORMA ACTIVA</div><h2>La logística, bajo control.</h2><p>Visualizá tus envíos, verificá repartidores y mantené tu operación conectada desde un mismo lugar.</p><Link to="/envios" className="btn btn-white">Ir a mis envíos <span>→</span></Link></div><div className="welcome-graphic" aria-hidden="true"><span className="graphic-ring ring-one"/><span className="graphic-ring ring-two"/><span className="graphic-box">▣</span><span className="graphic-pin">✦</span></div></div>
    {error&&<div className="inline-error">{error}</div>}
    <div className="metrics-grid"><Metric label="Envíos visibles" value={loading?'…':shipments.length} caption="Según tu identidad y permisos" icon="▣"/><Metric label="En ruta" value={loading?'…':inProgress} caption="Traslados en proceso" icon="↗"/><Metric label="Entregados" value={loading?'…':delivered} caption="Operaciones finalizadas" icon="✓"/><Metric label={hasRole('ADMIN')?'Repartidores':'Rol de acceso'} value={hasRole('ADMIN')?(loading?'…':couriers.length):(user?.roles[0]||'—')} caption={hasRole('ADMIN')?'Registrados en Courier':'Validado por Security'} icon="◎"/></div>
    <div className="dashboard-grid"><section className="panel"><div className="panel-heading row-between"><div><h2>Últimos envíos</h2><p>Actividad reciente según tus permisos.</p></div><Link className="text-link" to="/envios">Ver todos →</Link></div>{shipments.length===0?<Empty title="Todavía no hay envíos visibles" description="Los registros aparecerán cuando el backend devuelva operaciones autorizadas."/>:<div className="table-wrap"><table><thead><tr><th>SEGUIMIENTO</th><th>DESTINO</th><th>ESTADO</th><th>FECHA</th></tr></thead><tbody>{shipments.slice(0,5).map(x=><tr key={x.id}><td><Link to={`/envios/${x.id}`} className="table-link">{x.codigoSeguimiento||shortId(x.id)}</Link></td><td>{x.destino?.ciudad}</td><td><Badge value={x.estado}/></td><td>{dateText(x.createdAt)}</td></tr>)}</tbody></table></div>}</section><section className="panel shortcuts-panel"><div className="panel-heading"><h2>Accesos rápidos</h2><p>Todo lo que necesitás, a un clic.</p></div><div className="tile-list"><NavTile icon="▣" title="Consultar envíos" detail="Estado, seguimiento e historial" to="/envios"/>{hasRole('ADMIN','REPARTIDOR')&&<NavTile icon="◎" title="Repartidores" detail="Datos y disponibilidad" to="/courier"/>}{hasRole('ADMIN')&&<NavTile icon="⌘" title="Administración" detail="Crear y vincular identidades" to="/admin"/>}</div></section></div>
    <div className="footnote">Fuente: microservicios LogiTrack a través de API Gateway · Las autorizaciones se verifican en el backend.</div>
  </>
}
