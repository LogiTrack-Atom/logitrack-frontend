import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { statusText } from '../utils/format'

export function Badge({value}: {value:string}) {
  const status = value === 'ENTREGADO' || value === 'ACTIVO' ? 'green' : value === 'CANCELADO' || value === 'INACTIVO' ? 'red' : value === 'EN_RUTA' ? 'blue' : 'amber'
  return <span className={`status status-${status}`}><span className="status-dot"/>{statusText(value)}</span>
}
export function PageTitle({eyebrow,title,description,actions}: {eyebrow?:string; title:string; description?:string; actions?:ReactNode}) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow || 'LOGITRACK / OPERACIONES'}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{actions&&<div className="page-actions">{actions}</div>}</div>
}
export function Empty({title='Sin resultados',description='No se encontraron registros con los filtros seleccionados.',action}: {title?:string;description?:string;action?:ReactNode}) {
  return <div className="empty"><div className="empty-symbol">◇</div><h3>{title}</h3><p>{description}</p>{action}</div>
}
export function Loading({label='Cargando datos...'}:{label?:string}) { return <div className="loading"><span className="spinner"/>{label}</div> }
export function ErrorPanel({message,onRetry}:{message:string;onRetry?:()=>void}) {return <div className="error-panel"><span className="circle-alert">!</span><div><strong>No pudimos completar la solicitud</strong><p>{message}</p></div>{onRetry&&<button className="btn btn-outline" onClick={onRetry}>Reintentar lectura</button>}</div>}
export function Metric({label,value,caption,icon}: {label:string;value:string|number;caption?:string;icon?:string}) {return <div className="metric"><div className="metric-top"><span>{label}</span><span className="metric-icon">{icon||'↗'}</span></div><div className="metric-value">{value}</div>{caption&&<p>{caption}</p>}</div>}
export function NavTile({title,detail,to,icon}: {title:string;detail:string;to:string;icon:string}) {return <Link to={to} className="nav-tile"><span className="nav-tile-icon">{icon}</span><div><strong>{title}</strong><p>{detail}</p></div><span className="tile-arrow">↗</span></Link>}
export function CopyText({text}:{text?:string|null}){return <span className="copy-value"><code>{text || '—'}</code>{text&&<button aria-label="Copiar identificador" title="Copiar" onClick={()=>void navigator.clipboard.writeText(text)}>⧉</button>}</span>}
export function Section({title,description,children}: {title:string;description?:string;children:ReactNode}){return <section className="panel"><div className="panel-heading"><h2>{title}</h2>{description&&<p>{description}</p>}</div>{children}</section>}
