import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api/services'
import { readableError } from '../api/errors'

export function Register(){
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('')
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);const navigate=useNavigate()
  const submit=async(e:FormEvent)=>{e.preventDefault();if(busy)return
    if(password!==confirm){setError('Las contraseñas no coinciden.');return}
    if(new TextEncoder().encode(password).length>72){setError('La contraseña debe tener como máximo 72 bytes UTF-8.');return}
    setBusy(true);setError('');try{await authApi.register(email,password);navigate('/login',{replace:true,state:{registered:true}})}catch(e){setError(readableError(e))}finally{setBusy(false);setPassword('');setConfirm('')}
  }
  return <div className="auth-page"><div className="auth-aside"><div className="auth-brand"><span className="auth-brand-logo">L↗</span> LogiTrack</div><div className="auth-aside-content"><div className="auth-kicker">UNITE A LOGITRACK</div><h1>Tu próxima entrega<br/><em>empieza acá.</em></h1><p>Creá tu cuenta de cliente y empezá a gestionar tus envíos con seguimiento y seguridad.</p></div><div className="auth-foot">Registro público · Rol CLIENTE</div></div><div className="auth-main"><div className="auth-box"><div className="auth-overline">NUEVA CUENTA</div><h2>Crear cuenta</h2><p className="auth-subtitle">El registro público asigna exclusivamente el rol CLIENTE.</p><form className="form-stacked" onSubmit={submit}><label>Correo electrónico<input type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} placeholder="cliente@ejemplo.com"/></label><label>Contraseña<input type="password" autoComplete="new-password" minLength={12} maxLength={72} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 12 caracteres"/></label><label>Confirmar contraseña<input type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>{error&&<div className="inline-error" role="alert">{error}</div>}<button disabled={busy} className="btn btn-primary btn-block">{busy?'Creando cuenta...':'Registrarme'} →</button></form><p className="auth-join">¿Ya tenés cuenta? <Link to="/login">Iniciar sesión</Link></p></div></div></div>
}
