import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  // converter가 import attributes(with { type: 'json' })를 사용하므로 esnext 필요.
  // 빈도 데이터 청크(약 1.1MB, gzip 약 370KB)는 y2h 진입 시에만 내려받는 데이터라 크기 경고 기준을 올린다
  build: { target: 'esnext', chunkSizeWarningLimit: 1500 },
  // 대량 입력 변환 Worker(src/lib/convert.worker.ts)는 ES 모듈로 번들 (new Worker(..., { type: 'module' }))
  worker: { format: 'es' },
});
