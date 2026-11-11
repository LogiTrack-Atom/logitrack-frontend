FROM node@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts eslint.config.js ./
COPY src/ ./src/
COPY public/ ./public/
# Valores públicos compilados por Vite; nunca pasar secretos como build-args.
ARG VITE_API_BASE_URL=""
ARG VITE_USE_MOCKS=true
ARG VITE_ASYNC_ASSIGNMENT=false
RUN VITE_ASYNC_ASSIGNMENT="$VITE_ASYNC_ASSIGNMENT" VITE_API_BASE_URL="$VITE_API_BASE_URL" VITE_USE_MOCKS="$VITE_USE_MOCKS" npm run build

FROM nginx@sha256:583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311 AS runtime
LABEL org.opencontainers.image.source="https://github.com/LogiTrack-Atom/logitrack-frontend"
RUN rm -f /etc/nginx/conf.d/default.conf && rm -rf /usr/share/nginx/html/*
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 docker/15-validate-gateway.sh /docker-entrypoint.d/15-validate-gateway.sh
COPY --from=build --chown=nginx:nginx /app/dist/ /usr/share/nginx/html/
ENV NGINX_ENVSUBST_OUTPUT_DIR=/tmp/nginx-conf \
    NGINX_ENVSUBST_FILTER="^GATEWAY_UPSTREAM$" \
    NGINX_ENTRYPOINT_QUIET_LOGS=1
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=2s --start-period=5s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
