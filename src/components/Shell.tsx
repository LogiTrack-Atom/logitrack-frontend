import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import type { Role } from '../types'

const nav: Array<{to:string;label:string;icon:string;roles:Role[]}> = [
  {to:'/',label:'Resumen general',icon:'◫',roles:['ADMIN','CLIENTE','REPARTIDOR']},
  {to:'/envios',label:'Gestión de envíos',icon:'▣',roles:['ADMIN','CLIENTE','REPARTIDOR']},
  {to:'/courier',label:'Repartidores',icon:'◎',roles:['ADMIN','REPARTIDOR']},
  {to:'/admin',label:'Administración',icon:'⌘',roles:['ADMIN']},
]
export function Shell() {
  const {user,hasRole,logout}=useAuth()
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><img src="/logo-logitrack.png" alt="" className="brand-image"/><div> <strong>LogiTrack</strong><small>OPERATIONS HUB</small></div></div>
      <div className="workspace-chip"><span className="workspace-dot"/> ENTORNO DE DESARROLLO <span className="workspace-chevron">⌄</span></div>
      <p className="sidebar-label">ESPACIO DE TRABAJO</p>
      <nav aria-label="Navegación principal">{nav.filter(n=>hasRole(...n.roles)).map(n=><NavLink key={n.to} to={n.to} end={n.to==='/'} className={({isActive})=>`side-link ${isActive?'side-active':''}`}><span className="side-icon">{n.icon}</span>{n.label}</NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-help"><div className="sidebar-help-icon">✧</div><strong>Logística conectada</strong><p>Tus operaciones, en un solo lugar.</p><small>SPRINT 04 · REACT</small></div><div className="sidebar-footer">© 2026 LogiTrack Atom</div></div>
    </aside>
    <div className="main-area"><header className="topbar"><div className="topbar-breadcrumb"><span>LogiTrack</span><span className="crumb-sep">/</span><strong>Panel operativo</strong></div><div className="topbar-right"><span className="online-pill"><span/> Gateway</span><div className="avatar">{user?.email.slice(0,1).toUpperCase()}</div><div className="account"><strong>{user?.email}</strong><small>{user?.roles.join(' · ')}</small></div><button type="button" className="logout" onClick={logout}>Salir ↗</button></div></header>
      <main id="main-content" className="content"><Outlet/></main>
    </div>
  </div>
}
