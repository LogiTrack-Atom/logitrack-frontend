import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// El navegador solo llama al origen Vite; el dev proxy reenvía al Gateway.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/applications': {
        target: process.env.LOGITRACK_GATEWAY_DEV_TARGET || 'http://127.0.0.1:8066',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
