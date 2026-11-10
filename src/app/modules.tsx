import { UI_ROLES } from '../modules/auth/permissions'
import type { AppModule } from '../modules/types'
import { AdminPage } from '../modules/admin/AdminPage'
import { HomePage } from '../modules/home/HomePage'
import { CouriersPage } from '../modules/couriers/CouriersPage'
import { ShipmentsPage } from '../modules/shipments/ShipmentsPage'

/**
 * Registro de módulos. El router y el menú se arman desde esta lista.
 * Para sumar un módulo: crear su carpeta en src/modules y agregar una entrada acá.
 * Todos los paths empiezan con "/".
 */
export const appModules: AppModule[] = [
  { id: 'admin', label: 'Administración', path: '/admin', element: <AdminPage />, showInMenu: true, allowedRoles: UI_ROLES.administration },
  { id: 'home', label: 'Inicio', path: '/', element: <HomePage />, showInMenu: true, allowedRoles: UI_ROLES.all },
  { id: 'couriers', label: 'Repartidores', path: '/couriers', element: <CouriersPage />, showInMenu: true, allowedRoles: UI_ROLES.couriers },
  { id: 'shipments', label: 'Envíos', path: '/shipments', element: <ShipmentsPage />, showInMenu: true, allowedRoles: UI_ROLES.all },
]
