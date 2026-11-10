import { test, expect } from '@playwright/test'

test('al entrar sin JWT exige iniciar sesión',async({page})=>{
  await page.goto('/envios')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading',{name:'Iniciar sesión'})).toBeVisible()
})

test('recarga sin token conduce a login',async({page})=>{
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
})

function fixtureToken(roles:string[]){
  return `header.${Buffer.from(JSON.stringify({iss:'logitrack-security',aud:['logitrack-api'],sub:'00000000-0000-4000-8000-000000000001',roles,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.signature`
}

test('CLIENTE ve envíos pero no panel ADMIN (contratos mockeados)',async({page})=>{
  await page.route('**/applications/apisecurity/api/v1/auth/login',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({accessToken:fixtureToken(['CLIENTE']),tokenType:'Bearer',expiresIn:3600})}))
  await page.route('**/applications/apisecurity/api/v1/auth/me',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'00000000-0000-4000-8000-000000000001',email:'cliente@ejemplo.test',roles:['CLIENTE']})}))
  await page.route('**/applications/apishipment/api/v1/envios*',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}))
  await page.goto('/login')
  await page.getByPlaceholder('nombre@ejemplo.com').fill('cliente@ejemplo.test')
  await page.getByPlaceholder('Ingresá tu contraseña').fill('contraseña-de-prueba')
  await page.getByRole('button',{name:/Ingresar a LogiTrack/}).click()
  await expect(page).toHaveURL('http://127.0.0.1:5173/')
  await expect(page.getByRole('link',{name:/Gestión de envíos/})).toBeVisible()
  await expect(page.getByRole('link',{name:/Administración/})).toHaveCount(0)
  await page.getByRole('button',{name:/Salir/}).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/login$/)
})

test('respuesta 403 finaliza la sesión sin repetir login',async({page})=>{
  await page.route('**/applications/apisecurity/api/v1/auth/login',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({accessToken:fixtureToken(['CLIENTE']),tokenType:'Bearer',expiresIn:3600})}))
  await page.route('**/applications/apisecurity/api/v1/auth/me',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({id:'00000000-0000-4000-8000-000000000001',email:'cliente@ejemplo.test',roles:['CLIENTE']})}))
  await page.route('**/applications/apishipment/api/v1/envios*',route=>route.fulfill({status:403,contentType:'application/json',body:'{"mensaje":"Acceso denegado"}'}))
  await page.goto('/login')
  await page.getByPlaceholder('nombre@ejemplo.com').fill('cliente@ejemplo.test')
  await page.getByPlaceholder('Ingresá tu contraseña').fill('contraseña-de-prueba')
  await page.getByRole('button',{name:/Ingresar a LogiTrack/}).click()
  await expect(page).toHaveURL(/\/login$/)
})
