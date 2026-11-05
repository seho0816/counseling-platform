import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // 프론트에서는 http://localhost:8080 을 직접 쓰지 않고 /api/... 로만 요청한다.
    // 설정을 바꾼 뒤에는 Vite 개발 서버를 다시 시작해야 한다.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
