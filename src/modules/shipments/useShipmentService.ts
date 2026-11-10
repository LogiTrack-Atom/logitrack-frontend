import { useMemo } from 'react'
import { demoGateway } from '../../shared/http/demoGateway'
import { useAuth } from '../auth/session/authContext'
import { createSessionHttpClient } from '../../shared/http/sessionHttpClient'
import { createShipmentService } from './services/shipmentService'

export function useShipmentService() {
  const { session, state } = useAuth()
  return useMemo(() => createShipmentService(createSessionHttpClient(session, demoGateway, state.epoch)), [session, state.epoch])
}
