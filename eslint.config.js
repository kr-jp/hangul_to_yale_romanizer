// 린트 설정 — 오류를 잡는 규칙만 쓴다 (포매팅 규칙·포매터 없음)
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  // prototypes/ = 초기 디자인 시안(HTML), public/ = 빌드 시 생성물, .claude/ = 로컬 작업 도구(워크트리 사본 포함)
  globalIgnores(['dist/', 'public/', 'prototypes/', '.claude/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    // 훅 규칙은 고전적인 두 가지만 — recommended 프리셋의 React Compiler 계열 규칙은 쓰지 않는다
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['tests/**', 'scripts/**', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    // 변환 엔진은 단위 테스트로 고정한 코드 — 동작이 같은 표현 차이([.\-]의 \- 등) 때문에 고치지 않는다
    files: ['src/converter/**'],
    rules: { 'no-useless-escape': 'off', 'no-useless-assignment': 'off' },
  },
  {
    // 기존 테스트는 고치지 않는다 (s = rec(…, s)처럼 마지막 대입을 쓰지 않는 서술이 있다)
    files: ['tests/**'],
    rules: { 'no-useless-assignment': 'off', '@typescript-eslint/no-unused-vars': 'off' },
  },
]);
