import { NavLink, Outlet } from 'react-router'
import { appModules } from '../app/modules'
import { MockBanner } from '../shared/components/MockBanner'
import { USE_MOCKS } from '../shared/config/env'
import styles from './AppLayout.module.css'

export function AppLayout() {
  const menuItems = appModules.filter((item) => item.showInMenu)

  return (
    <div className={styles.shell}>
      {USE_MOCKS && <MockBanner />}
      <header className={styles.header}>
        <span className={styles.brand}>LogiTrack</span>
        <nav aria-label="Principal" className={styles.nav}>
          {menuItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/login" className={styles.link}>
          Ingresar
        </NavLink>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
