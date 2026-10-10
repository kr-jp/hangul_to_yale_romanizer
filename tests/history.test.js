// 히스토리 기록 테스트 (src/lib/storage.ts) — localStorage는 메모리 대체물로 주입
// - 같은 편집 세션은 한 항목을 갱신 (입력 도중 상태가 쌓이지 않음), 지우는 중에는 긴 쪽 유지
// - 결과를 사용(세션 종료)한 뒤의 편집, 전혀 다른 텍스트는 새 항목
// - 변환 방향 저장·구버전 항목의 방향 추정, 대용량 입력 제외, 저장 용량 초과 시 오래된 항목부터 정리
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
let quota = Infinity;
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      if (String(v).length > quota) throw new Error('QuotaExceededError');
      store.set(k, String(v));
    },
    removeItem: (k) => store.delete(k),
  },
});
const { recordHistory, loadHistory, saveHistory, historyDirection, HIST_TEXT_MAX } = await import(
  '../src/lib/storage.ts'
);

const OPTS = { sep: '', labial: true };
const rec = (text, session, direction = 'h2y') => recordHistory({ text, opts: OPTS, direction }, session);
const texts = () => loadHistory().map((h) => h.text);

describe('편집 세션 단위 기록', () => {
  beforeEach(() => {
    store.clear();
    quota = Infinity;
  });

  test('타이핑 도중의 상태는 한 항목으로 갱신', () => {
    let s = rec('철수가', null);
    s = rec('철수가 학교에', s);
    s = rec('철수가 학교에 갔다.', s);
    assert.deepEqual(texts(), ['철수가 학교에 갔다.']);
  });

  test('뒤에서부터 지우는 중이면 긴 쪽을 유지', () => {
    let s = rec('철수가 학교에 갔다.', null);
    s = rec('철수가 학교에', s);
    assert.deepEqual(texts(), ['철수가 학교에 갔다.']);
    rec('철수가 집에 갔다.', s);
    assert.deepEqual(texts(), ['철수가 집에 갔다.']);
  });

  test('세션을 끊은 뒤(복사 등)의 편집은 새 항목', () => {
    rec('철수가 학교에', null);
    rec('철수가 학교에 갔다.', null);
    assert.deepEqual(texts(), ['철수가 학교에 갔다.', '철수가 학교에']);
  });

  test('전혀 다른 텍스트는 새 항목', () => {
    const s = rec('철수가 학교에 갔다.', null);
    rec('영희는 책을 읽었다.', s);
    assert.deepEqual(texts(), ['영희는 책을 읽었다.', '철수가 학교에 갔다.']);
  });

  test('입력을 비우면 세션 종료', () => {
    const s = rec('철수가', null);
    assert.equal(rec('', s), null);
  });

  test('고정·태그된 항목은 덮어쓰지 않음', () => {
    const s = rec('철수가', null);
    const hist = loadHistory();
    hist[0].pinned = true;
    saveHistory(hist);
    rec('철수가 학교에', s);
    assert.deepEqual(texts().sort(), ['철수가', '철수가 학교에']);
  });

  test('같은 텍스트·옵션·방향은 하나로 합치고 태그 유지', () => {
    rec('한국', null);
    const hist = loadHistory();
    hist[0].tags = ['예문'];
    saveHistory(hist);
    rec('한국', null);
    assert.equal(loadHistory().length, 1);
    assert.deepEqual(loadHistory()[0].tags, ['예문']);
  });

  test('방향이 다르면 같은 텍스트라도 별개 항목', () => {
    rec('kim', null, 'y2h');
    rec('kim', null, 'h2y');
    assert.equal(loadHistory().length, 2);
  });

  test('대용량 입력은 기록하지 않음', () => {
    rec('가'.repeat(HIST_TEXT_MAX + 1), null);
    assert.equal(loadHistory().length, 0);
  });

  test('저장 용량 초과 시 오래된 비고정 항목부터 정리', () => {
    for (let i = 0; i < 10; i++) rec(`예문 ${i}번 ${'가'.repeat(20)}`, null);
    quota = 600;
    rec('새 예문', null);
    const t = texts();
    assert.equal(t[0], '새 예문');
    assert.ok(t.length < 11);
    assert.ok(JSON.stringify(loadHistory()).length <= 600);
  });
});

describe('historyDirection', () => {
  test('저장된 방향 우선', () => {
    assert.equal(historyDirection({ text: '한국', direction: 'y2h' }), 'y2h');
  });

  test('구버전 항목은 한글 유무로 추정', () => {
    assert.equal(historyDirection({ text: '한국어' }), 'h2y');
    assert.equal(historyDirection({ text: 'hankwuke' }), 'y2h');
  });
});
