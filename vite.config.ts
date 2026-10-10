import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  // converter가 import attributes(with { type: 'json' })를 사용하므로 esnext 필요
  build: { target: 'esnext' },
  // 대량 입력 변환 Worker(src/lib/convert.worker.ts)는 ES 모듈로 번들 (new Worker(..., { type: 'module' }))
  worker: { format: 'es' },
});
