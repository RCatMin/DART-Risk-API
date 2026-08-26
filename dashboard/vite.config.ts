import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 백엔드가 CORS 헤더를 아직 안 보내므로, 개발 중엔 프록시로 우회한다
    // (백엔드 코드는 건드리지 않음 — 다른 워크트리에서 계속 작업 중이라).
    proxy: {
      '/api': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
    },
    // cloudflared quick tunnel(trycloudflare.com)로 발표 시연용 임시 공개 접속을 열어두기 위함 —
    // 발표 종료 후 제거할 것.
    allowedHosts: ['.trycloudflare.com'],
  },
})
