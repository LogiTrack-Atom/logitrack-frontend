import { describe, expect, it } from 'vitest'
import { beginSession, endSession, isCurrentGeneration, readToken, sessionGeneration, sessionSignal, subscribeSession } from '../src/auth/session'
const makeToken=()=>`h.${btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,roles:['CLIENTE']})).replaceAll('=','')}.s`
describe('sesión JWT in-memory',()=>{
  it('borra sesión y aborta pendientes; limpiar dos veces es idempotente',()=>{
    const notices: number[]=[]
    const unsubscribe=subscribeSession(()=>notices.push(sessionGeneration()))
    const generation=beginSession(makeToken())
    const signal=sessionSignal()
    expect(readToken()).not.toBeNull()
    expect(isCurrentGeneration(generation)).toBe(true)
    endSession()
    expect(readToken()).toBeNull()
    expect(signal.aborted).toBe(true)
    expect(isCurrentGeneration(generation)).toBe(false)
    const after=sessionGeneration()
    endSession()
    expect(sessionGeneration()).toBe(after)
    expect(notices.length).toBe(2)
    unsubscribe()
  })
})
