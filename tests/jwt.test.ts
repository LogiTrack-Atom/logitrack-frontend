import { describe, expect, it } from 'vitest'
import { decodeJwt, isJwtFresh, tokenRoles } from '../src/utils/jwt'
const token=(body:Record<string,unknown>)=>`h.${btoa(JSON.stringify(body)).replaceAll('=','').replaceAll('+','-').replaceAll('/','_')}.s`
describe('JWT en memoria / validación temporal local',()=>{
  it('no acepta token sin exp',()=>expect(isJwtFresh(token({roles:['ADMIN']}))).toBe(false))
  it('rechaza token expirado',()=>expect(isJwtFresh(token({exp:100}),101)).toBe(false))
  it('acepta token no expirado',()=>expect(isJwtFresh(token({exp:200}),100)).toBe(true))
  it('extrae solo roles conocidos',()=>expect(tokenRoles(token({roles:['ADMIN','UNKNOWN','CLIENTE']}))).toEqual(['ADMIN','CLIENTE']))
  it('maneja cadenas inválidas',()=>expect(decodeJwt('x.y.z')).toBeNull())
})
