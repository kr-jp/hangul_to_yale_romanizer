// 형태소 표기(하이픈·괄호)와 경계 기호 처리 테스트 (2026-10-10 수정)
// - 하이픈·마침표가 든 어절도 후보를 낸다 (구간마다 확률 변환이므로 교정 가능해야 함)
// - 선두·말미 하이픈 보존(-ko → -고), 자음만의 형태소는 자모(-(u)n → -(으)ㄴ)
// - 매핑 없는 모음 토큰('wo')으로 인한 문자 소실 방지, 변환되지 않는 토큰의 대소문자 보존
// - keepHyphens 옵션: 어절 내부 '-'를 한글 출력에 남김 (mek-ess-ta → 먹-었-다)
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  reverseConvert, parseYaleWordCandidates, setFrequencyData,
} from '../src/converter/y2h.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const words = (w, opts) => parseYaleWordCandidates(w, opts).map((c) => c.hangul);

describe('인용형 하이픈 보존 (탐욕 폴백)', () => {
  test('어미·접사·어간의 하이픈', () => {
    assert.equal(reverseConvert('-ko'), '-고');
    assert.equal(reverseConvert('mek-'), '먹-');
    assert.equal(reverseConvert('-ess-'), '-었-');
    assert.equal(reverseConvert('-keyss-'), '-겠-');
  });

  test('단독 하이픈(대시)도 사라지지 않음', () => {
    assert.equal(reverseConvert('a - b'), '아 - b');
    assert.equal(reverseConvert('-'), '-');
  });

  test('어절 내부 하이픈은 기본적으로 제거 (현행 유지)', () => {
    assert.equal(reverseConvert('mek-ess-ta'), '먹었다');
    assert.equal(reverseConvert('ka-ss-ta'), '갔다');
    assert.equal(reverseConvert('Chelswu-ka hakkyo-ey ka-ss-ta.'), '철수가 학교에 갔다.');
  });
});

describe('자음만의 형태소 → 자모', () => {
  test('괄호 표기', () => {
    assert.equal(reverseConvert('-(u)n'), '-(으)ㄴ');
    assert.equal(reverseConvert('-(u)l kes'), '-(으)ㄹ 것');
    assert.equal(reverseConvert('-(s)supnita'), '-(ㅅ)습니다');
    assert.equal(reverseConvert('-(e/a)se'), '-(어/아)서');
    assert.equal(reverseConvert('-(u)si-'), '-(으)시-');
  });

  test('하이픈 사이의 자음', () => {
    assert.equal(reverseConvert('-n-'), '-ㄴ-');
    assert.equal(reverseConvert('-ss-'), '-ㅆ-');
  });

  test('형태소 맥락이 아니면 원문 그대로 (약어·단위·쪽수)', () => {
    assert.equal(reverseConvert('pp. 23-45'), 'pp. 23-45');
    assert.equal(reverseConvert('(214m)'), '(214m)');
    assert.equal(reverseConvert('NP-ka'), 'NP-가');
  });
});

describe('문자 소실 방지·원문 보존', () => {
  test("'wo'(Yale에 없는 모음 표기)가 있어도 자음이 사라지지 않음", () => {
    assert.equal(reverseConvert('kwon'), 'kw온');
    assert.equal(reverseConvert('won'), 'w온');
    assert.equal(reverseConvert('two'), 'tw오');
  });

  test('변환되지 않는 토큰은 대소문자 유지', () => {
    assert.equal(reverseConvert('NP'), 'NP');
    assert.equal(reverseConvert('PST'), 'PST');
  });

  test('숫자 사이·말줄임표의 기호 보존', () => {
    assert.equal(reverseConvert('1992-92nyen'), '1992-92년');
    assert.equal(reverseConvert('e...e...kuliko'), '어...어...그리고');
  });
});

describe('keepHyphens 옵션', () => {
  const keep = { keepHyphens: true };

  test('형태소 경계를 남김', () => {
    assert.equal(reverseConvert('mek-ess-ta', keep), '먹-었-다');
    assert.equal(reverseConvert('Chelswu-ka hakkyo-ey', keep), '철수-가 학교-에');
  });

  test('자음만의 형태소는 종성에 붙이지 않고 자모로', () => {
    assert.equal(reverseConvert('ka-ss-ta', keep), '가-ㅆ-다');
    assert.equal(reverseConvert('ka-n-ta', keep), '가-ㄴ-다');
  });

  test("음절 경계 '.'은 옵션과 무관하게 제거", () => {
    assert.equal(reverseConvert('ce.nel-ul', keep), '저널-을');
  });

  test('후보 경로도 같은 결과', () => {
    assert.equal(words('mek-ess-ta', keep)[0], '먹-었-다');
  });
});

describe('하이픈·마침표가 든 어절의 후보 (빈도 데이터 주입)', () => {
  before(() => {
    const data = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'syllable-freq.json'), 'utf8'));
    setFrequencyData({ syllable: data.u, bigram: data.b, word: data.w });
  });
  after(() => setFrequencyData({}));

  test('형태소 경계가 있어도 후보를 고를 수 있음', () => {
    assert.ok(words('cenel-ul').includes('저널을'));
    assert.ok(words('tulama-lul').includes('드라마를'));
  });

  test('1위는 구간별 최선의 연결 (통째 변환과 일치)', () => {
    for (const w of ['cenel-ul', 'tulama-lul', 'salam-tul-i', 'Chelswu-ka']) {
      assert.equal(words(w)[0], reverseConvert(w));
    }
  });

  test('음절을 모두 구분해도 양순음 모호성은 후보로 남음', () => {
    assert.deepEqual(words('pu.lo.ku.laym'), ['부로그램', '브로그램']);
  });

  test('인용형 하이픈은 후보에도 유지', () => {
    assert.ok(words('-ko').every((w) => w.startsWith('-')));
  });
});
