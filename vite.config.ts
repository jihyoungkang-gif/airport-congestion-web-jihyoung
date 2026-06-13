import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const dataGoKrProxy = {
  '/api': {
    target: 'https://apis.data.go.kr',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: dataGoKrProxy,
  },
  preview: {
    proxy: dataGoKrProxy,
  },
})
