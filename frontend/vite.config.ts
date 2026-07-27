import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function isGoCamReferer(req: { headers: { referer?: string } }) {
  const referer = req.headers.referer ?? ''
  return (
    referer.includes('/go-cam-avs') ||
    referer.includes(':3300') ||
    referer.includes('/token/') ||
    referer.includes('/result/')
  )
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['.ngrok-free.dev'],
    // Tunnel ngrok → Vite → NestJS / Go.cam
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Official Go.cam AVS — same-origin under HTTPS ngrok (avoids mixed content)
      '/go-cam-avs': {
        target: 'http://localhost:3300',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/go-cam-avs/, '') || '/',
      },
      // Go.cam posts absolute /result/success and /result/fail from the iframe
      '/result': {
        target: 'http://localhost:3300',
        changeOrigin: true,
      },
      // Go.cam HTML references absolute /static/... assets
      '/static': {
        target: 'http://localhost:3300',
        changeOrigin: true,
        bypass(req) {
          if (isGoCamReferer(req)) return null
          return req.url
        },
      },
    },
  },
})
