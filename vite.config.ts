import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  plugins: [react()],
  server: {
    proxy: env.VITE_DATA_SOURCE === 'backend'
      ? { '/api': { target: env.EASYCARE_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: true } }
      : undefined,
  },
  define: {
    'process.env': {},
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@frontdesk': fileURLToPath(
        new URL('./src/modules/frontdesk', import.meta.url),
      ),
      '@hmo': fileURLToPath(
        new URL('./src/modules/hmo', import.meta.url),
      ),
      '@pharmacy': fileURLToPath(
        new URL('./src/modules/pharmacy', import.meta.url),
      ),
      '@doctor-shared': fileURLToPath(
        new URL('./src/pages/doctor/shared', import.meta.url),
      ),
    }
  }
  }
})
