// 출력 파이프라인 테스트 (src/lib/convert-pipeline.ts — Node의 TypeScript 타입 제거 기능으로 직접 import)
// - Plain 출력은 후보 선택·예문 번호와 관계없이 원문의 빈 줄·공백을 보존 (2026-10-10 수정)
// - 분해형(NFD) 한글 입력 정규화, keepHyphens 옵션 전달
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setFrequencyData } from '../src/converter/y2h.js';
import { buildFormattedOutput, splitLines } from '../src/lib/convert-pipeline.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPTS = { sep: '', labial: true, keepHyphens: false };
const NO_GLOSS = { enabled: false, map: new Map() };
const plain = (text, { direction = 'y2h', numbered = false, overrides = new Map(), opts = OPTS } = {}) =>
  buildFormattedOutput(text, opts, 'plain', numbered, direction, overrides, NO_GLOSS);

describe('Plain 출력 — 줄·공백 보존', () => {
  before(() => {
    const data = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'syllable-freq.json'), 'utf8'));
    setFrequencyData({ syllable: data.u, bigram: data.b, word: data.w });
  });
  after(() => setFrequencyData({}));

  const TEXT = 'hankwuk  salam\n\ncenel\tilkessta';

  test('후보를 고른 뒤에도 빈 줄·연속 공백·탭이 그대로', () => {
    const overrides = new Map([['cenel', '저널']]);
    assert.equal(plain(TEXT), '한국  사람\n\n전얼\t읽었다');
    assert.equal(plain(TEXT, { overrides }), '한국  사람\n\n저널\t읽었다');
  });

  test('예문 번호는 내용이 있는 줄에만, 빈 줄은 유지', () => {
    assert.equal(plain('ka\n\nna', { numbered: true }), '(1) 가\n\n(2) 나');
    assert.equal(plain('한국\n\n사람', { direction: 'h2y', numbered: true }), '(1) hankwuk\n\n(2) salam');
  });

  test('keepHyphens 옵션이 출력에 반영', () => {
    assert.equal(plain('mek-ess-ta', { opts: { ...OPTS, keepHyphens: true } }), '먹-었-다');
    assert.equal(plain('mek-ess-ta'), '먹었다');
  });
});

describe('분해형(NFD) 한글 정규화', () => {
  test('h2y 출력', () => {
    assert.equal(plain('한국어'.normalize('NFD'), { direction: 'h2y' }), 'hankwuke');
  });

  test('줄 텍스트(글로스 키·표시 토큰)도 완성형', () => {
    assert.deepEqual(splitLines('한국\n사람'.normalize('NFD')), ['한국', '사람']);
  });
});
