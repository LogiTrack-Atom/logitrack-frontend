import type { ReactNode } from 'react'

/** Definición de un módulo de la aplicación; el router y el menú se arman desde estas entradas. */
export interface AppModule {
  id: string
  label: string
  /** Empieza con "/". El módulo de inicio usa "/". */
  path: string
  element: ReactNode
  /** false para rutas que no deben aparecer en el menú. */
  showInMenu: boolean
}
