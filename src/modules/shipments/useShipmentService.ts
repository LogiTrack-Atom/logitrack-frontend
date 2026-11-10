import { useMemo } from 'react'
import { USE_MOCKS } from '../../shared/config/env'
import { useAuth } from '../auth/session/authContext'
import { createSessionHttpClient } from '../../shared/http/sessionHttpClient'
import { createShipmentService } from './services/shipmentService'
import { createShipmentMockRequest } from './mocks/shipmentServer'

// Datos ficticios del servidor simulado, compartidos entre los perfiles de demostración.
// No es un caché de UI. Se reinicia al recargar; cada operación aplica pertenencia por ID.
const demoServer = createShipmentMockRequest()

export function useShipmentService() {
  const { session } = useAuth()
  return useMemo(() => createShipmentService(createSessionHttpClient(session, USE_MOCKS ? demoServer : undefined)), [session])
}
