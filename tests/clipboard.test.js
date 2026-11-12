// 클립보드 복사의 성공·실패 보고 (src/lib/clipboard.ts) (2026-11-12)
// 폴백(execCommand)까지 실패해도 '복사 완료' 알림이 뜨던 문제 — 호출 측이 결과를 알 수 있어야 한다
import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { copyText } from '../src/lib/clipboard.ts';

const saved = {
  navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
  document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
};

function stub(name, value) {
  Object.defineProperty(globalThis, name, { value, configurable: true });
}

// 임시 textarea를 흉내 내는 최소한의 document. execCommand('copy')의 결과를 정한다
function fakeDocument(execResult) {
  const calls = { appended: 0, removed: 0, copied: null };
  const doc = {
    createElement: () => ({
      value: '',
      select() {},
      remove() {
        calls.removed++;
      },
    }),
    body: {
      appendChild(el) {
        calls.appended++;
        doc.current = el;
      },
    },
    execCommand(cmd) {
      if (cmd === 'copy' && execResult) calls.copied = doc.current.value;
      return execResult;
    },
  };
  return { doc, calls };
}

afterEach(() => {
  for (const [name, desc] of Object.entries(saved)) {
    if (desc) Object.defineProperty(globalThis, name, desc);
    else delete globalThis[name];
  }
});

describe('copyText', () => {
  test('navigator.clipboard가 되면 true', async () => {
    let written = null;
    stub('navigator', { clipboard: { writeText: async (t) => void (written = t) } });
    assert.equal(await copyText('가나다'), true);
    assert.equal(written, '가나다');
  });

  test('navigator.clipboard가 거절되면 execCommand 폴백 — 성공하면 true', async () => {
    stub('navigator', { clipboard: { writeText: async () => Promise.reject(new Error('denied')) } });
    const { doc, calls } = fakeDocument(true);
    stub('document', doc);
    assert.equal(await copyText('가나다'), true);
    assert.equal(calls.copied, '가나다');
    assert.equal(calls.removed, 1);
  });

  test('폴백까지 실패하면 false (임시 textarea는 치운다)', async () => {
    stub('navigator', {});
    const { doc, calls } = fakeDocument(false);
    stub('document', doc);
    assert.equal(await copyText('가나다'), false);
    assert.equal(calls.appended, 1);
    assert.equal(calls.removed, 1);
  });
});
