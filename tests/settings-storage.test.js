// 설정 영속화 테스트 (src/lib/storage.ts) (2026-11-12)
// - 변환 방향을 저장해 다시 열어도 유지 (예전에는 새로 열 때마다 한글 → Yale로 돌아갔다)
// - 테마는 저장된 값이 우선, 없으면 시스템의 다크 모드 설정을 따른다 (예전에는 항상 라이트)
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => void store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
});
let systemDark = false;
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { matchMedia: (q) => ({ matches: q === '(prefers-color-scheme: dark)' && systemDark }) },
});
const { KEYS, readDirection, writeDirection, readTheme, writeTheme } = await import('../src/lib/storage.ts');

beforeEach(() => {
  store.clear();
  systemDark = false;
});

describe('변환 방향', () => {
  test('저장된 값이 없으면 한글 → Yale', () => {
    assert.equal(readDirection(), 'h2y');
  });

  test('저장한 방향을 다시 읽는다 (키: yaleDirectionV1)', () => {
    writeDirection('y2h');
    assert.equal(store.get('yaleDirectionV1'), 'y2h');
    assert.equal(KEYS.direction, 'yaleDirectionV1');
    assert.equal(readDirection(), 'y2h');
    writeDirection('h2y');
    assert.equal(readDirection(), 'h2y');
  });

  test('잘못된 저장값은 무시', () => {
    store.set('yaleDirectionV1', 'sideways');
    assert.equal(readDirection(), 'h2y');
  });
});

describe('테마 기본값', () => {
  test('저장된 값이 없으면 시스템 설정을 따른다', () => {
    assert.equal(readTheme(), 'light');
    systemDark = true;
    assert.equal(readTheme(), 'dark');
  });

  test('저장된 값이 시스템 설정보다 우선', () => {
    systemDark = true;
    writeTheme('light');
    assert.equal(readTheme(), 'light');
    systemDark = false;
    writeTheme('dark');
    assert.equal(readTheme(), 'dark');
  });

  test('잘못된 저장값이면 시스템 설정', () => {
    store.set('yaleThemeV1', 'sepia');
    systemDark = true;
    assert.equal(readTheme(), 'dark');
  });
});
