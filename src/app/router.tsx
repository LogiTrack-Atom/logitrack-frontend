import { createBrowserRouter } from 'react-router'
import type { RouteObject } from 'react-router'
import { AppLayout } from '../layouts/AppLayout'
import { LoginPage } from '../modules/auth/LoginPage'
import { appModules } from './modules'
import { NotFoundPage } from './NotFoundPage'

const moduleRoutes = appModules.map((item): RouteObject =>
  item.path === '/'
    ? { index: true, element: item.element }
    : { path: item.path.slice(1), element: item.element },
)

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [...moduleRoutes, { path: '*', element: <NotFoundPage /> }],
  },
])
