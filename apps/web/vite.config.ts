import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:43120',
      '/health': 'http://127.0.0.1:43120',
    },
  },
  build: {
    // 发布包不携带源码映射与源码内容；开发调试通过 dev server 的 TS 源码进行。
    sourcemap: false,
  },
});
