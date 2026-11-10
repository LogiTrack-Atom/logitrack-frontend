import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { readableError } from '../src/api/errors'
function responseError(status:number,data:unknown){const headers=new AxiosHeaders();return new AxiosError('HTTP error','ERR_BAD_RESPONSE',undefined,undefined,{data,status,statusText:'Error',headers,config:{headers}})}
describe('Error HTTP sanitizado',()=>{
  it('explica 409',()=>expect(readableError(responseError(409,{mensaje:'Conflicto de datos'}))).toContain('conflicto'))
  it('explica 503',()=>expect(readableError(responseError(503,{}))).toContain('no está disponible'))
  it('oculta mensajes con tokens',()=>expect(readableError(responseError(400,{mensaje:'Bearer eyJabcdefghijklmno'}))).not.toContain('eyJ'))
})
