import { RouterProvider } from 'react-router/dom'
import { AuthProvider } from '../modules/auth/session/AuthProvider'
import { router } from './router'

export function App() {
  return <AuthProvider><RouterProvider router={router} /></AuthProvider>
}
