#!/bin/sh
# Valida únicamente configuración pública; no registra el valor del entorno.
set -eu

invalid() {
    echo 'GATEWAY_UPSTREAM debe ser un origen http/https sin ruta, credenciales ni caracteres de configuración.' >&2
    exit 1
}

upstream=${GATEWAY_UPSTREAM:-}
newline='
'
case "$upstream" in *"$newline"*) invalid ;; esac
if ! printf '%s' "$upstream" | awk '
    BEGIN { ok = 1 }
    NR != 1 || $0 !~ /^https?:\/\/([A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?|\[[A-Fa-f0-9:]+\])(:[0-9]+)?$/ { ok = 0 }
    END { exit !(NR == 1 && ok) }
'; then
    invalid
fi
port=${upstream##*:}
case "$port" in
    ''|*[!0-9]*) ;;
    *) printf '%s' "$port" | awk 'END { exit !($0 + 0 > 0 && $0 + 0 <= 65535) }' || invalid ;;
esac
mkdir -p "$NGINX_ENVSUBST_OUTPUT_DIR"
