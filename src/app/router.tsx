import { createBrowserRouter } from 'react-router'
import type { RouteObject } from 'react-router'
import { AppLayout } from '../layouts/AppLayout'
import { LoginPage } from '../modules/auth/LoginPage'
import { RequireSession } from '../modules/auth/session/RequireSession'
import { RequireRole } from '../modules/auth/session/RequireRole'
import { appModules } from './modules'
import { NotFoundPage } from './NotFoundPage'

const moduleRoutes = appModules.map((item): RouteObject =>
  item.path === '/'
    ? { index: true, element: <RequireRole roles={item.allowedRoles}>{item.element}</RequireRole> }
    : { path: item.path.slice(1), element: <RequireRole roles={item.allowedRoles}>{item.element}</RequireRole> },
)

/** Rutas de la app. Se exportan por separado para poder probarlas con un router en memoria. */
export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <LoginPage key="register" register /> },
  {
    element: <RequireSession />,
    children: [{
      path: '/',
      element: <AppLayout />,
      children: [...moduleRoutes, { path: '*', element: <NotFoundPage /> }],
    }],
  },
]

export const router = createBrowserRouter(routes)
