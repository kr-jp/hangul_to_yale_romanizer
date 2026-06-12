// 어말 마침표 처리 테스트 (2026-06-12 수정)
// 단어 끝의 '.'(뒤에 글자가 없는 run)는 음절 경계가 아니라 문장부호로 취급한다:
// 변환 전에 분리하고 결과에 재부착 — 마침표 보존 + 빔서치(후보 다수) 유지.
// 단어 내부의 '.'와 '-'(어말 포함)는 기존 경계 의미를 그대로 유지한다.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  reverseConvert, parseYaleWordCandidates, setFrequencyData,
} from '../src/converter/y2h.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('어말 마침표 (탐욕 폴백 — 빈도 데이터 없음)', () => {
  test('마침표 보존', () => {
    assert.equal(reverseConvert('hankwuk.'), '한국.');
    assert.equal(reverseConvert('annyeng.'), '안녕.');
  });

  test('말줄임표 보존', () => {
    assert.equal(reverseConvert('hankwuk...'), '한국...');
  });

  test('내부 경계는 기존 의미 유지', () => {
    assert.equal(reverseConvert('sal.ip.ni.ta'), '살입니다');
  });

  test('내부 경계 + 어말 마침표 혼합', () => {
    assert.equal(reverseConvert('sal.ip.ni.ta.'), '살입니다.');
  });

  test('마침표만 있는 토큰은 그대로 보존', () => {
    assert.equal(reverseConvert('hankwuk ...'), '한국 ...');
  });
});

describe('어말 마침표 (빈도 데이터 주입 — 빔서치)', () => {
  before(() => {
    const data = JSON.parse(
      readFileSync(join(__dirname, '..', 'data', 'syllable-freq.json'), 'utf8'),
    );
    setFrequencyData({ syllable: data.u, bigram: data.b, word: data.w });
  });

  after(() => {
    setFrequencyData({});
  });

  test('어말 마침표가 있어도 후보 다수 (클릭 교정 가능)', () => {
    const plain = parseYaleWordCandidates('masisse', { labial: true }, 5);
    const dotted = parseYaleWordCandidates('masisse.', { labial: true }, 5);
    assert.ok(plain.length > 1, '기준: 마침표 없는 단어는 후보 다수');
    assert.equal(dotted.length, plain.length, '마침표가 후보 수를 줄이면 안 됨');
  });

  test('후보의 한글에 마침표가 재부착됨', () => {
    const dotted = parseYaleWordCandidates('masisse.', { labial: true }, 5);
    for (const c of dotted) {
      assert.ok(c.hangul.endsWith('.'), `후보 "${c.hangul}"에 마침표 누락`);
    }
    assert.equal(dotted[0].hangul, '맛있어.');
  });

  test('후보 순위는 마침표 유무와 무관하게 동일', () => {
    const plain = parseYaleWordCandidates('masisse', { labial: true }, 5);
    const dotted = parseYaleWordCandidates('masisse.', { labial: true }, 5);
    assert.deepEqual(
      dotted.map((c) => c.hangul),
      plain.map((c) => `${c.hangul}.`),
    );
  });

  test('reverseConvert도 마침표 보존 + 빔서치 경로', () => {
    assert.equal(reverseConvert('masisse.'), '맛있어.');
  });

  test('내부 경계 단어는 어말 마침표가 있어도 결정론(후보 1개) 유지', () => {
    const c = parseYaleWordCandidates('sal.ip.ni.ta.', { labial: true }, 5);
    assert.equal(c.length, 1);
    assert.equal(c[0].hangul, '살입니다.');
  });

  test('기존 suffix 보존과의 합성: 마침표+물음표', () => {
    const c = parseYaleWordCandidates('masisse.?', { labial: true }, 5);
    assert.ok(c.length >= 1);
    assert.ok(c[0].hangul.endsWith('.?'));
  });
});
