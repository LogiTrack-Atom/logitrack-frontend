#!/usr/bin/env python3
"""Regresión funcional contra un laboratorio local descartable, sin mocks ni secretos en salida.

Requiere S04_GATEWAY_URL, S04_ADMIN_EMAIL y S04_ADMIN_PASSWORD en el entorno.
Crea datos ficticios nuevos; no limpia ni altera datos anteriores. No usar en producción.
Los JWT viven únicamente en memoria. La salida distingue escenarios, requests y aserciones.
"""
import json
import os
import secrets
import sys
import uuid
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, HTTPRedirectHandler


class NoRedirect(HTTPRedirectHandler):
    """Impide reenviar las credenciales a un destino de redirección."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def main():
    """Ejecuta contratos HTTP y reglas de pertenencia en el Gateway local configurado."""
    base = os.environ['S04_GATEWAY_URL'].rstrip('/')
    url = urlsplit(base)
    if url.scheme != 'http' or url.hostname not in ('127.0.0.1', 'localhost') or url.path or url.query or url.fragment or url.username or url.password:
        raise ValueError('Se requiere un Gateway HTTP de loopback sin credenciales ni ruta.')
    opener = build_opener(NoRedirect())
    results = []
    requests = assertions = 0

    def check(value, message):
        nonlocal assertions
        assertions += 1
        if not value:
            raise AssertionError(message)

    def call(service, path, expected=200, token=None, body=None, method='GET'):
        nonlocal requests
        requests += 1
        headers = {'Accept': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        if body is not None:
            headers['Content-Type'] = 'application/json'
        req = Request(f'{base}/applications/api{service}/api/v1/{path}',
                      data=None if body is None else json.dumps(body).encode(), headers=headers, method=method)
        try:
            response = opener.open(req, timeout=30)
        except HTTPError as error:
            response = error
        with response:
            check(response.code == expected, f'{method} {service}/{path}: HTTP {response.code}, esperado {expected}')
            # No consumir cuerpos de error ni incluirlos en diagnósticos.
            return json.load(response) if response.code < 400 else None

    def login(email, password):
        return call('security', 'auth/login', body={'email': email, 'password': password}, method='POST')['accessToken']

    run = uuid.uuid4().hex[:12]
    password = secrets.token_urlsafe(24)
    admin = login(os.environ['S04_ADMIN_EMAIL'], os.environ['S04_ADMIN_PASSWORD'])
    check('ADMIN' in call('security', 'auth/me', token=admin)['roles'], 'Rol administrativo')
    call('shipment', 'envios', expected=401)
    call('security', 'auth/login', expected=401, method='POST', body={'email': f'inexistente-{run}@example.test', 'password': password})
    results.append('autenticación y rechazo de credenciales inválidas')

    clients = []
    for index in range(2):
        email = f'cliente-{run}-{index}@example.test'
        user = call('security', 'auth/register', expected=201, method='POST', body={'email': email, 'password': password})
        token = login(email, password)
        check(call('security', 'auth/me', token=token)['id'] == user['id'], 'Identidad del cliente')
        clients.append(token)
    client, other = clients
    call('courier', 'repartidores', expected=403, token=client)
    results.append('registro público CLIENTE y permisos por rol')

    email = f'repartidor-{run}@example.test'
    user = call('security', 'usuarios', expected=201, method='POST', token=admin, body={'email': email, 'password': password, 'rol': 'REPARTIDOR'})
    check(call('security', 'usuarios/' + user['id'], token=admin)['roles'] == ['REPARTIDOR'], 'Lectura de identidad creada')
    rider = login(email, password)
    resource = call('courier', 'repartidores', expected=201, method='POST', token=admin, body={'nombre': 'Repartidor ficticio ' + run, 'tipoVehiculo': 'Bicicleta'})
    rid = resource['id']
    check(call('courier', 'repartidores/' + rid, token=admin)['estado'] == 'ACTIVO', 'Lectura de ficha creada')
    call('courier', 'repartidores/' + rid, expected=403, token=rider)
    call('courier', 'repartidores/' + rid + '/usuario', method='PUT', token=admin, body={'usuarioId': user['id']})
    check(call('courier', 'repartidores/' + rid + '/usuario', token=admin)['usuarioId'] == user['id'], 'Lectura del vínculo Courier')
    check(call('courier', 'repartidores/' + rid, token=rider)['id'] == rid, 'Ficha propia vinculada')
    check(call('shipment', 'envios', token=rider) == [], 'Courier vinculado sin referencias Shipment no recibe envíos')
    results.append('alta administrativa y asociación parcial Courier')

    reference = 'asociaciones/repartidores/' + rid
    association = call('shipment', reference, method='PUT', token=admin, body={'usuarioId': user['id']})
    check(association['usuarioId'] == user['id'], 'Referencia Shipment confirmada por PUT')
    # La repetición controlada es válida para este PUT idéntico; no acredita idempotencia de POST.
    check(call('shipment', reference, method='PUT', token=admin, body={'usuarioId': user['id']}) == association, 'Repetición del mismo PUT de referencia')
    results.append('referencia Shipment y repetición del mismo PUT')

    address = {'calle': 'Ejemplo', 'numero': '123', 'ciudad': 'Jujuy', 'codigoPostal': '4600'}
    shipment = call('shipment', 'envios', expected=201, method='POST', token=client, body={
        'cliente': {'nombre': 'Cliente ficticio ' + run, 'email': f'contacto-{run}@example.test'},
        'origen': address, 'destino': address, 'pesoKg': 1.25, 'anchoCm': 25.25, 'altoCm': 15.50, 'largoCm': 30.75})
    path = 'envios/' + shipment['id']
    check(call('shipment', path, token=client)['estado'] == 'PENDIENTE', 'Lectura posterior al alta')
    call('shipment', path, expected=403, token=other)
    call('shipment', 'envios/seguimiento/' + shipment['codigoSeguimiento'], expected=403, token=other)
    check(call('shipment', 'envios', token=other) == [], 'Listado ajeno vacío')
    results.append('alta de envío y aislamiento entre clientes incluso por tracking')

    call('shipment', path + '/repartidor', method='PUT', token=admin, body={'repartidorId': rid})
    check(call('shipment', path, token=admin)['estado'] == 'PENDIENTE', 'Asignación no cambia estado')
    check(len(call('shipment', path + '/historial', token=admin)) == 1, 'Asignación no agrega transición')
    check(any(row['id'] == shipment['id'] for row in call('shipment', 'envios', token=rider)), 'Listado de asignación propia')
    results.append('asignación sin transición ni evento adicional')

    for state in ['EN_RUTA', 'ENTREGADO']:
        call('shipment', path + '/estado', method='PATCH', token=rider, body={'estado': state})
        check(call('shipment', path, token=client)['estado'] == state, 'Lectura posterior al cambio de estado')
    history = call('shipment', path + '/historial', token=client)
    check([event['estadoNuevo'] for event in history] == ['PENDIENTE', 'EN_RUTA', 'ENTREGADO'], 'Historial de tres estados')
    results.append('entrega por repartidor y lecturas posteriores por cliente')

    check(call('courier', 'repartidores/' + rid + '/disponibilidad', token=rider)['disponible'], 'Disponibilidad de repartidor activo')
    results.append('disponibilidad real de ficha propia')
    print(json.dumps({'ok': True, 'escenarios': len(results), 'requests_http': requests, 'aserciones': assertions,
                      'pruebas_java_ejecutadas': 0, 'escenarios_verificados': results}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (AssertionError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        # No imprimir excepciones de transporte que puedan contener parámetros sensibles.
        print('No se pudo completar la regresión: revisar disponibilidad y configuración privada del laboratorio.', file=sys.stderr)
        sys.exit(1)
