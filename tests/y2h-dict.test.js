// 사용자 사전(opts.dict)·영어 이름·공범주 표기 테스트 (2026-10)
// - Yale에 없는 글자가 든 구간(John)·대문자 약어(IP)는 원문 그대로, 옆의 하이픈도 남긴다
// - 숫자가 붙은 단독 e(공범주 e₁)는 그대로, 하이픈 뒤 자음 형태소의 숫자는 지표(-n1 → -ㄴ1)
// - 사전: 형태소 항목은 다른 어절 안에서도, 어절 항목은 어절 전체가 같을 때만. 사전별 캐시 분리
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  reverseConvert, parseYaleWordCandidates, setFrequencyData, analyzeToken, yaleRunsIn,
} from '../src/converter/y2h.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dict = (words = {}, morphemes = {}) => ({
  words: new Map(Object.entries(words)),
  morphemes: new Map(Object.entries(morphemes)),
});

describe('영어 이름·약어는 원문 그대로', () => {
  test('Yale에 없는 글자(b d f g j q r v x z)가 든 구간', () => {
    assert.equal(reverseConvert('John-un'), 'John-은');
    assert.equal(reverseConvert('Mary-ka'), 'Mary-가');
    assert.equal(reverseConvert('David-ul manna-ss-ta.'), 'David-을 만났다.');
    assert.equal(reverseConvert('John-un', { keepHyphens: true }), 'John-은');
  });

  test('ng의 g는 Yale 글자', () => {
    assert.equal(reverseConvert('kang'), '강');
    assert.equal(reverseConvert('pang-ey'), '방에');
  });

  test('대문자로만 된 약어', () => {
    assert.equal(reverseConvert('IP-ey'), 'IP-에');
    assert.equal(reverseConvert('NOM'), 'NOM');
  });

  test('첫 글자만 대문자인 Yale 이름은 변환', () => {
    assert.equal(reverseConvert('Chelswu-ka'), '철수가');
    assert.equal(reverseConvert('Yenghuy-nun'), '영희는');
  });
});

describe('공범주·지표 표기', () => {
  test('숫자가 바로 붙은 단독 e는 그대로 (e₁을 복사한 형태)', () => {
    assert.equal(reverseConvert('[e1'), '[e1');
    assert.equal(reverseConvert('ce [e1 khi-ka khu]-n1 yeca'), '저 [e1 키가 크]-ㄴ1 여자');
  });

  test('하이픈 뒤 자음 형태소에 붙은 숫자는 지표', () => {
    assert.equal(reverseConvert('-n1'), '-ㄴ1');
    assert.equal(reverseConvert('ka-n1', { keepHyphens: true }), '가-ㄴ1');
  });

  test('그 밖의 e·숫자 옆 자음은 기존대로', () => {
    assert.equal(reverseConvert('e'), '어');
    assert.equal(reverseConvert('e, kulayyo'), '어, 그래요');
    assert.equal(reverseConvert('(214m)'), '(214m)');
  });
});

// 예시는 표준 Yale에서 빈도 데이터가 1위를 틀리는 어형 — 사전으로 바로잡는 전형적인 경우
describe('사용자 사전 (빈도 데이터 주입)', () => {
  before(() => {
    const data = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'syllable-freq.json'), 'utf8'));
    setFrequencyData({ syllable: data.u, bigram: data.b, word: data.w });
  });
  after(() => setFrequencyData({}));

  test('형태소 항목은 다른 어절 안에서도 쓰인다', () => {
    const d = dict({}, { tuli: '드리' }); // 엔진 1위는 들이
    assert.equal(reverseConvert('tuli-ess-ta tuli-ko', { dict: d }), '드리었다 드리고');
    assert.equal(reverseConvert('tuli-ess-ta', { dict: d, keepHyphens: true }), '드리-었-다');
    assert.equal(reverseConvert('tuli', { dict: d }), '드리');
  });

  test('어절 항목(구간별 값): 종성 결합·하이픈 표시는 평소대로', () => {
    const d = dict({ 'aphu-n': '아프-ㄴ' }); // 엔진 1위는 앞은
    assert.equal(reverseConvert('aphu-n', { dict: d }), '아픈');
    assert.equal(reverseConvert('aphu-n', { dict: d, keepHyphens: true }), '아프-ㄴ');
    assert.equal(reverseConvert('(aphu-n)', { dict: d }), '(아픈)');
  });

  test('어절 항목(구간 수가 다른 값): 값 그대로', () => {
    const d = dict({ 'aphu-n': '아픈' });
    assert.equal(reverseConvert('aphu-n', { dict: d, keepHyphens: true }), '아픈');
  });

  test('어절 항목은 어절 전체가 같을 때만', () => {
    // 문헌 고유 표기: 네(표준 Yale은 ney)를 ne로 쓰는 경우. 표준 Yale의 ne(너)가 든 형태소에는 영향 없음
    const d = dict({ ne: '네' });
    assert.equal(reverseConvert('ne kes', { dict: d }), '네 것');
    assert.equal(reverseConvert('ne-nun', { dict: d }), '너는');
  });

  test('어절 항목이 형태소 항목보다 우선', () => {
    const d = dict({ 'mali-nun': '머리-는' }, { mali: '마리' });
    assert.equal(reverseConvert('Mali-nun Mali-ka', { dict: d }), '머리는 마리가');
  });

  test('대소문자 무시, 앞뒤 기호 보존', () => {
    const d = dict({}, { mali: '마리' });
    assert.equal(reverseConvert('Mali-nun.', { dict: d }), '마리는.');
    assert.equal(reverseConvert('-mali-', { dict: d }), '-마리-');
  });

  test('영어 이름에도 형태소 항목을 줄 수 있다', () => {
    assert.equal(reverseConvert('John-un', { dict: dict({}, { john: '존' }) }), '존은');
  });

  test('사전이 바뀌면 결과도 바뀐다 (사전별 캐시)', () => {
    const a = dict({}, { mali: '마리' });
    const b = dict({}, { mali: '말이' });
    assert.equal(reverseConvert('mali', { dict: a }), '마리');
    assert.equal(reverseConvert('mali', { dict: b }), '말이');
    assert.equal(reverseConvert('mali', { dict: a }), '마리');
    assert.equal(reverseConvert('mali'), reverseConvert('mali', { dict: null }));
  });
});

describe('후보의 구간별 출력(parts)·사전 표시 (빈도 데이터 주입)', () => {
  before(() => {
    const data = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'syllable-freq.json'), 'utf8'));
    setFrequencyData({ syllable: data.u, bigram: data.b, word: data.w });
  });
  after(() => setFrequencyData({}));

  test('후보마다 구간별 출력', () => {
    const cands = parseYaleWordCandidates('Mali-nun');
    assert.ok(cands.length > 1);
    for (const c of cands) assert.equal(c.parts.length, 2);
    assert.deepEqual(parseYaleWordCandidates('ka-ss-ta')[0].parts, ['가', 'ㅆ', '다']);
  });

  test('사전 항목이 쓰인 후보는 dict = true', () => {
    const [c] = parseYaleWordCandidates('Mali-nun', { dict: dict({}, { mali: '마리' }) });
    assert.deepEqual([c.hangul, c.parts, c.dict], ['마리는', ['마리', '는'], true]);
    assert.equal(parseYaleWordCandidates('Mali-nun')[0].dict, false);
  });

  test('값 그대로 쓰는 어절 항목은 parts 없음', () => {
    const [c] = parseYaleWordCandidates('aphu-n,', { dict: dict({ 'aphu-n': '아픈' }) });
    assert.deepEqual([c.hangul, c.parts, c.dict], ['아픈,', null, true]);
  });
});

describe('토큰 구성 (사전 학습용)', () => {
  test('analyzeToken', () => {
    assert.deepEqual(analyzeToken('(Mali-nun,'), {
      lead: '', tail: '', key: 'mali-nun', segments: ['mali', 'nun'], vowel: [true, true],
      prefix: '(', suffix: ',',
    });
    assert.equal(analyzeToken('-ko').lead, '-');
    assert.equal(analyzeToken('ka-ss-ta').vowel[1], false);
    assert.equal(analyzeToken('123'), null);
    assert.equal(analyzeToken('ka,na'), null); // Yale run이 둘
    assert.equal(analyzeToken('...'), null);
  });

  test('yaleRunsIn', () => {
    assert.deepEqual(yaleRunsIn('tuli-ess-ta (ku) 1992').map((r) => r.key), ['tuli-ess-ta', 'ku']);
  });
});
