import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactElement } from 'react'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { Notifications } from './components/Notifications'
import { Shell } from './components/Shell'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { Shipments } from './pages/Shipments'
import { ShipmentForm } from './pages/ShipmentForm'
import { ShipmentDetail } from './pages/ShipmentDetail'
import { Couriers } from './pages/Couriers'
import { CourierDetail } from './pages/CourierDetail'
import { Admin } from './pages/Admin'
import type { Role } from './types'

function Guard({roles,children}:{roles?:Role[];children:ReactElement}){
  const {isAuthenticated,hasRole}=useAuth();const location=useLocation()
  if(!isAuthenticated)return <Navigate replace to="/login" state={{from:location.pathname}}/>
  if(roles&&!hasRole(...roles))return <Navigate replace to="/"/>
  return children
}
export function App(){return <BrowserRouter><AuthProvider><Notifications><Routes>
  <Route path="/login" element={<Login/>}/><Route path="/registro" element={<Register/>}/>
  <Route element={<Guard><Shell/></Guard>}>
    <Route index element={<Dashboard/>}/>
    <Route path="/envios" element={<Shipments/>}/>
    <Route path="/envios/nuevo" element={<Guard roles={['ADMIN','CLIENTE']}><ShipmentForm/></Guard>}/>
    <Route path="/envios/:id" element={<ShipmentDetail/>}/>
    <Route path="/courier" element={<Guard roles={['ADMIN','REPARTIDOR']}><Couriers/></Guard>}/>
    <Route path="/courier/:id" element={<Guard roles={['ADMIN','REPARTIDOR']}><CourierDetail/></Guard>}/>
    <Route path="/admin" element={<Guard roles={['ADMIN']}><Admin/></Guard>}/>
  </Route>
  <Route path="*" element={<Navigate replace to="/"/>}/>
</Routes></Notifications></AuthProvider></BrowserRouter>}
