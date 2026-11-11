import { useMemo } from 'react'
import { useAuth } from '../auth/session/authContext'
import { createSessionHttpClient } from '../../shared/http/sessionHttpClient'
import { demoGateway } from '../../shared/http/demoGateway'
import { createCourierService } from './services/courierService'

export function useCourierService() {
  const { session, state } = useAuth()
  return useMemo(() => createCourierService(createSessionHttpClient(session, demoGateway, state.epoch)), [session, state.epoch])
}
