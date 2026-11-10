import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Destino del Gateway solo para `npm run dev`; no entra al bundle.
const gateway = process.env.DEV_GATEWAY_URL ?? 'http://localhost:8066'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Conserva /applications/... íntegro: el Gateway quita sus dos primeros segmentos.
    proxy: { '/applications': { target: gateway } },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
