import { NavLink, Outlet } from 'react-router'
import { appModules } from '../app/modules'
import { MockBanner } from '../shared/components/MockBanner'
import { USE_MOCKS } from '../shared/config/env'
import { hasAnyRole } from '../modules/auth/permissions'
import { useAuth } from '../modules/auth/session/authContext'
import { Button } from '../shared/components/Button'
import styles from './AppLayout.module.css'

const navigationOrder = ['home', 'shipments', 'couriers', 'admin']
const navigationSymbols: Record<string, string> = { home: '▦', shipments: '◇', couriers: '◎', admin: '⚙' }
const roleLabels = { ADMIN: 'Administración', CLIENTE: 'Cliente', REPARTIDOR: 'Repartidor' }

export function AppLayout() {
  const { session, state } = useAuth()
  const menuItems = appModules
    .filter((item) => item.showInMenu && hasAnyRole(state.user, item.allowedRoles))
    .sort((first, second) => navigationOrder.indexOf(first.id) - navigationOrder.indexOf(second.id))
  const email = state.user?.email

  return (
    <div className={styles.shell}>
      {USE_MOCKS && <MockBanner />}
      <a href="#contenido" className={styles.skip}>Saltar al contenido</a>
      <div className={styles.frame}>
        <header className={styles.header}>
          <img className={styles.brand} src="/assets/branding/logitrack-horizontal.webp" width="520" height="174" alt="LogiTrack Atom" />
          <div className={styles.account}>
            <span className={styles.avatar} aria-hidden="true">{email?.slice(0, 1).toUpperCase()}</span>
            <div className={styles.accountDetails}>
              <strong>{email}</strong>
              <span>{state.user?.roles.map((role) => roleLabels[role]).join(' · ')}</span>
            </div>
            <Button variant="secondary" onClick={() => session.logout()}>Cerrar sesión</Button>
          </div>
        </header>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarBrand}>
            <img src="/assets/branding/logitrack-isotipo-contraste-small.webp" width="48" height="44" alt="" />
            <span>Operaciones</span>
          </div>
          <nav aria-label="Principal" className={styles.nav}>
            {menuItems.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                end={item.path === '/'}
                className={styles.link}
              >
                <span className={styles.navIcon} aria-hidden="true">{navigationSymbols[item.id]}</span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main id="contenido" tabIndex={-1} className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
