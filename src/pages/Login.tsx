import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { readableError } from '../api/errors'

export function Login() {
  const {login,isAuthenticated}=useAuth()
  const navigate=useNavigate()
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  if (isAuthenticated) return <Navigate to="/" replace/>
  const submit=async(e:FormEvent)=>{
    e.preventDefault(); if(busy)return
    setBusy(true);setError('')
    try{await login(email,password);setPassword('');navigate('/',{replace:true})}
    catch(err){setError(readableError(err));setPassword('')}
    finally{setBusy(false)}
  }
  return <div className="auth-page"><div className="auth-aside"><div className="auth-brand"><img src="/logo-logitrack.png" alt="Logo de LogiTrack" className="auth-logo-image"/> LogiTrack</div><div className="auth-aside-content"><div className="auth-kicker">LOGÍSTICA DE NUEVA GENERACIÓN</div><h1>Todo tu mundo logístico,<br/><em>en movimiento.</em></h1><p>Gestioná envíos, coordiná repartidores y seguí cada entrega desde una única plataforma.</p><div className="auth-card"><span>◈</span><div><strong>Una plataforma. Todas tus operaciones.</strong><p>Acceso seguro para administradores, clientes y repartidores.</p></div></div></div><div className="auth-foot">LogiTrack Atom · Sprint 04</div></div>
    <div className="auth-main"><div className="auth-box"><div className="auth-mobile-brand"><img src="/logo-logitrack.png" alt="Logo de LogiTrack" className="auth-logo-image"/><span>LogiTrack</span></div><div className="auth-overline">TE DAMOS LA BIENVENIDA</div><h2>Iniciar sesión</h2><p className="auth-subtitle">Ingresá tus credenciales para acceder a tu espacio.</p><form onSubmit={submit} className="form-stacked"><label>Correo electrónico<input type="email" autoComplete="username" placeholder="nombre@ejemplo.com" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Contraseña<input type="password" autoComplete="current-password" placeholder="Ingresá tu contraseña" required value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<div className="inline-error" role="alert">{error}</div>}<button className="btn btn-primary btn-block" disabled={busy}>{busy?'Validando sesión...':'Ingresar a LogiTrack'} <span>→</span></button></form><p className="auth-join">¿No tenés una cuenta? <Link to="/registro">Registrate como cliente</Link></p><div className="auth-note">El token se conserva solo en memoria. Al recargar, tendrás que volver a iniciar sesión.</div></div></div>
  </div>
}
