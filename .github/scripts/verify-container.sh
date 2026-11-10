#!/usr/bin/env bash
# Humo de empaquetado; no sustituye aceptación de negocio con Gateway real.
set -euo pipefail
container="frontend-ci-${RANDOM}"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$container" --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m --cap-drop ALL \
  --security-opt no-new-privileges -p 127.0.0.1::8080 \
  -e GATEWAY_UPSTREAM=http://127.0.0.1:9 logitrack-frontend:ci >/dev/null
ready=false
for attempt in {1..30}; do
  if [[ "$(docker inspect --format '{{.State.Health.Status}}' "$container")" == healthy ]]; then ready=true; break; fi
  sleep 1
done
[[ "$ready" == true ]]
[[ "$(docker inspect --format '{{.Config.User}}' "$container")" == nginx ]]
[[ "$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}' "$container")" == true ]]
port=$(docker inspect --format '{{(index (index .NetworkSettings.Ports "8080/tcp") 0).HostPort}}' "$container")
base="http://127.0.0.1:$port"
[[ "$(curl --fail --silent --show-error "$base/healthz")" == ok ]]
root=$(curl --fail --silent --show-error "$base/")
[[ "$root" == "$(curl --fail --silent --show-error "$base/shipments")" ]]
[[ "$root" == "$(curl --fail --silent --show-error "$base/admin")" ]]
[[ "$(curl --silent --show-error -o /dev/null -w '%{http_code}' "$base/assets/missing.js")" == 404 ]]
[[ "$(curl --silent --show-error -o /dev/null -w '%{http_code}' "$base/api/unknown")" == 404 ]]
[[ "$(curl --silent --show-error -o /dev/null -w '%{http_code}' "$base/applications/apisecurity/api/v1/auth/me")" == 502 ]]
[[ "$(curl --silent --show-error "$base/applications/apisecurity/api/v1/auth/me")" != "$root" ]]
echo 'Runtime verificado: salud, no-root/read-only, deep links, assets y API sin fallback SPA.'
