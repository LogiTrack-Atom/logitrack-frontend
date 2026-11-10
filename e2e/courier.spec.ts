import { expect, test } from '@playwright/test'

const courierId = '123e4567-e89b-42d3-a456-426614174000'
const foreignId = '123e4567-e89b-42d3-a456-426614174001'
const userId = '223e4567-e89b-42d3-a456-426614174000'
const courier = {id:courierId,nombre:'Juan Pérez',tipoVehiculo:'Moto',estado:'ACTIVO',createdAt:'2026-11-05T10:00:00Z',updatedAt:'2026-11-05T10:00:00Z'}
function token(roles: string[]) {
  const data = {sub:userId,exp:Math.floor(Date.now()/1000)+3600,roles,iss:'logitrack-security',aud:['logitrack-api']}
  return `header.${Buffer.from(JSON.stringify(data)).toString('base64url')}.signature`
}
async function login(page: import('@playwright/test').Page, role: 'ADMIN'|'CLIENTE'|'REPARTIDOR') {
  await page.route('**/applications/apisecurity/api/v1/auth/login', async route => {
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({accessToken:token([role]),tokenType:'Bearer',expiresIn:3600})})
  })
  await page.route('**/applications/apisecurity/api/v1/auth/me', async route => {
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:userId,email:'demo@example.test',roles:[role]})})
  })
  await page.route('**/applications/apishipment/api/v1/envios*', async route => {
    await route.fulfill({status:200,contentType:'application/json',body:'[]'})
  })
  await page.goto('/login')
  await page.getByPlaceholder('nombre@ejemplo.com').fill('demo@example.test')
  await page.getByPlaceholder('Ingresá tu contraseña').fill('test-password')
  await page.getByRole('button',{name:/Ingresar a LogiTrack/}).click()
  await expect(page).toHaveURL('http://127.0.0.1:5173/')
}

test('CLIENTE no puede acceder al módulo Courier',async({page})=>{
  await login(page,'CLIENTE')
  await expect(page.getByRole('link',{name:/Repartidores/})).toHaveCount(0)
  await page.goto('/courier')
  await expect(page).toHaveURL('http://127.0.0.1:5173/')
})

test('ADMIN filtra la lista, consulta disponibilidad y confirma PATCH sin DELETE',async({page})=>{
  const requested: {method:string;url:string;body:string|null}[]=[]
  let state = 'ACTIVO'
  await page.route('**/applications/apicourier/api/v1/repartidores**', async route=>{
    const request=route.request(),url=new URL(request.url())
    const method=request.method(),path=url.pathname
    requested.push({method,url:request.url(),body:request.postData()})
    const payload= {...courier,estado:state}
    if(method==='GET' && path.endsWith('/repartidores')) {
      await route.fulfill({status:200,json:url.searchParams.get('estado')==='INACTIVO'?[]:[payload]})
    } else if(method==='GET' && path.endsWith(`/${courierId}`)) {
      await route.fulfill({status:200,json:payload})
    } else if(method==='GET' && path.endsWith(`/${courierId}/disponibilidad`)) {
      await route.fulfill({status:200,json:{repartidorId:courierId,estado:state,disponible:state==='ACTIVO'}})
    } else if(method==='PATCH' && path.endsWith(`/${courierId}/estado`)) {
      state='INACTIVO'
      await route.fulfill({status:200,json:{...payload,estado:state}})
    } else {
      await route.fulfill({status:404,json:{mensaje:'Ruta no mockeada'}})
    }
  })
  await login(page,'ADMIN')
  await page.goto('/courier')
  await expect(page.getByText('Juan Pérez')).toBeVisible()
  await page.getByLabel('Filtrar repartidores por estado').selectOption('INACTIVO')
  await expect(page.getByText('Sin repartidores')).toBeVisible()
  await page.getByLabel('Filtrar repartidores por estado').selectOption('ACTIVO')
  await page.getByRole('link',{name:'Ver detalle →'}).click()
  await page.getByRole('button',{name:/Consultar disponibilidad/}).click()
  await expect(page.getByText('Disponible',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Desactivar'}).click()
  await expect(page.getByText('INACTIVO',{exact:true}).first()).toBeVisible()
  await page.getByRole('button',{name:/Consultar disponibilidad/}).click()
  await expect(page.getByText('No disponible',{exact:true})).toBeVisible()
  expect(requested.some(x=>x.method==='DELETE')).toBe(false)
  expect(requested.some(x=>x.method==='PATCH' && x.body==='{"estado":"INACTIVO"}')).toBe(true)
})

test('REPARTIDOR nunca solicita listado ni muestra opciones de escritura',async({page})=>{
  const paths: string[]=[]
  await page.route('**/applications/apicourier/api/v1/repartidores**',async route=>{
    paths.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`)
    await route.fulfill({status:200,json:new URL(route.request().url()).pathname.endsWith('/disponibilidad')
      ? {repartidorId:courierId,estado:'ACTIVO',disponible:true}
      : courier})
  })
  await login(page,'REPARTIDOR')
  await page.goto('/courier')
  await expect(page.getByText('Mi recurso de repartidor')).toBeVisible()
  await page.getByPlaceholder('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx').fill(courierId)
  await page.getByRole('button',{name:/Consultar mi ficha/}).click()
  await expect(page.getByText('Juan Pérez')).toBeVisible()
  await expect(page.getByRole('button',{name:'Desactivar'})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Guardar cambios'})).toHaveCount(0)
  expect(paths).not.toContain('GET /applications/apicourier/api/v1/repartidores')
})

test('REPARTIDOR no puede abrir la ficha ajena: respuesta 403 invalidará sesión',async({page})=>{
  await page.route('**/applications/apicourier/api/v1/repartidores/**', async route=>{
    await route.fulfill({status:403,json:{mensaje:'Acceso denegado.'}})
  })
  await login(page,'REPARTIDOR')
  await page.goto(`/courier/${foreignId}`)
  await expect(page).toHaveURL(/\/login$/)
})

test('ADMIN crea (201) y edita (PUT) con lectura de confirmación, sin operación DELETE', async ({page}) => {
  const writes: {method:string;body:string|null}[] = []
  let persisted = { ...courier }
  await page.route('**/applications/apicourier/api/v1/repartidores**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if (req.method() === 'POST' && path.endsWith('/repartidores')) {
      writes.push({method:'POST',body:req.postData()})
      const dto = req.postDataJSON() as {nombre:string;tipoVehiculo:string}
      persisted = { ...persisted, ...dto }
      await route.fulfill({status:201,json:persisted})
    } else if (req.method() === 'PUT' && path.endsWith(`/${courierId}`)) {
      writes.push({method:'PUT',body:req.postData()})
      const dto = req.postDataJSON() as {nombre:string;tipoVehiculo:string}
      persisted = { ...persisted, ...dto, updatedAt:'2026-11-06T10:00:00Z' }
      await route.fulfill({status:200,json:persisted})
    } else if (req.method() === 'GET' && path.endsWith('/repartidores')) {
      await route.fulfill({status:200,json:[]})
    } else if (req.method() === 'GET' && path.endsWith(`/${courierId}`)) {
      await route.fulfill({status:200,json:persisted})
    } else {
      await route.fulfill({status:404,json:{mensaje:'Ruta no mockeada'}})
    }
  })
  await login(page,'ADMIN')
  await page.goto('/courier')
  await page.getByRole('textbox',{name:'Nombre'}).fill('Juan Pérez')
  await page.getByRole('textbox',{name:'Tipo de vehículo'}).fill('Moto')
  await page.getByRole('button',{name:/Crear repartidor/}).click()
  await expect(page).toHaveURL(new RegExp(`/courier/${courierId}$`))
  await page.getByRole('textbox',{name:'Nombre'}).fill('Juan Actualizado')
  await page.getByRole('textbox',{name:'Tipo de vehículo'}).fill('Bici')
  await page.getByRole('button',{name:'Guardar cambios'}).click()
  await expect(page.getByText('Juan Actualizado')).toBeVisible()
  expect(writes).toEqual([
    {method:'POST',body:'{"nombre":"Juan Pérez","tipoVehiculo":"Moto"}'},
    {method:'PUT',body:'{"nombre":"Juan Actualizado","tipoVehiculo":"Bici"}'},
  ])
})

test('202 Accepted mantiene bloqueo de segundo POST hasta conciliación manual',async({page})=>{
  let postCount=0
  await page.route('**/applications/apicourier/api/v1/repartidores**',async route=>{
    const req=route.request()
    if (req.method()==='POST') { postCount++; await route.fulfill({status:202,json:{}}) }
    else await route.fulfill({status:200,json:[]})
  })
  await login(page,'ADMIN')
  await page.goto('/courier')
  await page.getByRole('textbox',{name:'Nombre'}).fill('Juan Pérez')
  await page.getByRole('textbox',{name:'Tipo de vehículo'}).fill('Moto')
  await page.getByRole('button',{name:/Crear repartidor/}).click()
  await expect(page.getByText(/El alta pudo haberse realizado/)).toBeVisible()
  await expect(page.getByRole('button',{name:/Crear repartidor/})).toBeDisabled()
  expect(postCount).toBe(1)
})
