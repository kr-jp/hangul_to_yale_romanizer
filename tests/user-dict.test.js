// 사용자 사전 테스트 (src/lib/user-dict.ts — Node의 TypeScript 타입 제거 기능으로 직접 import)
// 규칙은 형태소 분석 없이 Yale 원문의 표기와 그대로 대조한다: 구간 일치(segment, '-'로 나뉜 부분) / 전체 일치(whole, 표기 본체 전체)
// - planCorrection: 고친 결과로 만들 수 있는 두 범위의 규칙과 기본 범위, 구간 일치를 고를 수 없는 이유
// - 하이픈 없이 입력해도 Yale로 맞춰 구간에 나눈다 (아픈 → 아프 | ㄴ) — 입력 방식이 범위를 정하지 않게
// - 엔진 결과로 되돌리면 항목 삭제, 바뀐 것이 없으면 변경 없음, 토큰의 구두점은 떼어 냄
// - 외부 데이터(저장소·파일·공유 URL) 정화 — 첫 배포 때의 키 이름(words·morphemes)도 읽음
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseYaleWordCandidates, setFrequencyData } from '../src/converter/y2h.js';
import {
  EMPTY_DICT, applyChange, candidateText, describeToken, dictFromJSON, dictToJSON, entriesUsedIn, isEditableToken,
  learnCorrection, mergeDicts, planCorrection,
} from '../src/lib/user-dict.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dict = (whole = {}, segment = {}) => ({
  segment: new Map(Object.entries(segment)),
  whole: new Map(Object.entries(whole)),
});
const opts = (d = null, extra = {}) => ({ sep: '', labial: true, keepHyphens: false, dict: d, ...extra });
const segment = (key, value, remove = []) => ({ add: [{ scope: 'segment', key, value }], remove });
const whole = (key, value, remove = []) => ({ add: [{ scope: 'whole', key, value }], remove });

describe('고친 결과 → 사전 규칙 (빈도 데이터 주입)', () => {
  before(() => {
    const data = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'syllable-freq.json'), 'utf8'));
    setFrequencyData({ syllable: data.u, bigram: data.b, word: data.w });
  });
  after(() => setFrequencyData({}));

  test('두 범위의 규칙과 기본값: 2음절 이상 부분은 구간 일치', () => {
    const p = planCorrection('tuli-ess-ta', '드리-었-다', opts());
    assert.equal(p.kind, 'rule');
    assert.deepEqual(p.segment, segment('tuli', '드리'));
    assert.deepEqual(p.whole, whole('tuli-ess-ta', '드리-었-다'));
    assert.equal(p.defaultScope, 'segment');
    assert.equal(p.segmentBlocked, null);
  });

  test('하이픈 없이 입력해도 Yale로 맞춰 구간에 나눈다 — 입력 방식이 범위를 정하지 않음', () => {
    const p = planCorrection('aphu-n', '아픈', opts());
    assert.deepEqual(p.segment, segment('aphu', '아프'));
    assert.deepEqual(p.whole, whole('aphu-n', '아프-ㄴ'));
    assert.equal(p.defaultScope, 'segment');
    assert.deepEqual(learnCorrection('aphu-n', '아프-ㄴ', opts()), learnCorrection('aphu-n', '아픈', opts()));
  });

  test('1음절 부분은 구간 일치도 고를 수 있지만 기본값은 전체 일치', () => {
    // 문헌 고유 표기를 고치는 경우: 키(표준 Yale은 khi)를 ki로 쓴 문헌.
    // 구간 일치로 기억하면 표준 Yale의 ki(기)까지 바뀌므로 기본값은 전체 일치
    const p = planCorrection('ki-ka', '키-가', opts());
    assert.deepEqual(p.segment, segment('ki', '키'));
    assert.equal(p.defaultScope, 'whole');
    assert.equal(p.shortSegment, true);
    assert.deepEqual(learnCorrection('ki-ka', '키-가', opts()), whole('ki-ka', '키-가'));
  });

  test('구간 일치를 고를 수 없는 경우와 그 이유', () => {
    // 자음만의 부분을 바꿈
    const mixed = planCorrection('ka-ss-ta', '가-었-다', opts());
    assert.equal(mixed.segment, null);
    assert.equal(mixed.segmentBlocked, 'mixed');
    assert.deepEqual(mixed.whole, whole('ka-ss-ta', '가-었-다'));
    // 문헌 고유 표기(표준 Yale은 yeyppu-n)에 하이픈 없이 입력 — Yale이 달라 구간에 맞출 수 없다
    const unaligned = planCorrection('yeppu-n', '예쁜', opts());
    assert.equal(unaligned.segment, null);
    assert.equal(unaligned.segmentBlocked, 'unaligned');
    assert.deepEqual(unaligned.whole, whole('yeppu-n', '예쁜'));
    // 하이픈으로 나눠 입력하면 구간 일치도 된다
    assert.deepEqual(planCorrection('yeppu-n', '예쁘-ㄴ', opts()).segment, segment('yeppu', '예쁘'));
  });

  test('변환되지 않던 부분(영어 이름)은 1음절이어도 기본값이 구간 일치', () => {
    assert.deepEqual(learnCorrection('John-un', '존-은', opts()), segment('john', '존'));
  });

  test('토큰의 구두점·앞뒤 하이픈까지 입력해도 떼어 낸다', () => {
    assert.deepEqual(learnCorrection('kulemulo,', '그러므로,', opts()), segment('kulemulo', '그러므로'));
    assert.deepEqual(learnCorrection('-ko', '-구', opts()), whole('ko', '구'));
  });

  test('바뀐 것이 없거나 받을 수 없는 값', () => {
    assert.equal(planCorrection('tuli-ess-ta', '들이-었-다', opts()).kind, 'none');
    assert.equal(planCorrection('tuli-ess-ta', '들이었다', opts()).kind, 'none'); // 하이픈 없이 같은 값
    assert.equal(planCorrection('ka-ss-ta', '갔다', opts()).kind, 'none'); // 받침으로 붙은 자음도 맞춰 나눔
    assert.equal(planCorrection('John-un', 'John은', opts()).kind, 'none'); // 원문 그대로인 로마자
    assert.equal(planCorrection('ka', '가 나', opts()), null); // 공백
    assert.equal(planCorrection('ka', '   ', opts()), null);
    assert.equal(planCorrection('123', '일이삼', opts()), null); // Yale run 없음
    assert.equal(planCorrection('ka,na', '가나', opts()), null); // Yale run 둘
  });

  test('엔진 결과로 되돌리면 이 토큰에 쓰인 항목을 지운다', () => {
    const d = dict({}, { mali: '마리' });
    const p = planCorrection('Mali-nun', '말이-는', opts(d));
    assert.equal(p.kind, 'revert');
    assert.deepEqual(p.revert, { add: [], remove: [{ scope: 'segment', key: 'mali' }] });
    const base = parseYaleWordCandidates('Mali-nun', opts())[0];
    assert.deepEqual(learnCorrection('Mali-nun', candidateText(base), opts(d)).remove, [{ scope: 'segment', key: 'mali' }]);
  });

  test('구간 일치로 고치면 그것을 가리던 전체 일치 항목은 지운다', () => {
    const d = dict({ 'mali-nun': '마리-는' });
    assert.deepEqual(
      planCorrection('Mali-nun', '머리-는', opts(d)).segment,
      segment('mali', '머리', [{ scope: 'whole', key: 'mali-nun' }]),
    );
  });

  test('후보는 구간별 출력을 하이픈으로 이은 형태로 입력 칸에 들어간다 (keepHyphens와 무관)', () => {
    for (const keepHyphens of [false, true]) {
      const o = opts(null, { keepHyphens });
      const pick = parseYaleWordCandidates('Mali-nun', o).find((c) => c.parts.join('') === '마리는');
      assert.equal(candidateText(pick), '마리-는');
      assert.deepEqual(learnCorrection('Mali-nun', candidateText(pick), o), segment('mali', '마리'));
    }
  });

  test('describeToken: 입력 칸 초기값은 하이픈으로 나눈 형태', () => {
    assert.deepEqual(describeToken('(Mali-nun,', opts()), { yale: 'Mali-nun', prefill: '말이-는', hits: [] });
    const d = dict({}, { mali: '마리' });
    assert.deepEqual(describeToken('Mali-ka', opts(d)).hits, [{ scope: 'segment', key: 'mali', value: '마리' }]);
    assert.equal(describeToken('aphu-n', opts(dict({ 'aphu-n': '아픈' }))).prefill, '아픈');
    assert.equal(describeToken('1992', opts()), null);
  });
});

describe('사전 데이터 처리', () => {
  test('isEditableToken', () => {
    assert.ok(isEditableToken('tuli-ess-ta,'));
    assert.ok(!isEditableToken('-'));
    assert.ok(!isEditableToken('-(u)n'));
  });

  test('dictFromJSON: 잘못된 키·값은 버린다', () => {
    const d = dictFromJSON({
      whole: { 'Aphu-N': ' 아프-ㄴ ', 'ka ka': '가가', '-ko': '고', ok: 1 },
      segment: { mali: '마리', 'mali-nun': '마리는', __proto__x: '', empty: '', sp: '가 나', ['x'.repeat(3)]: '가'.repeat(61) },
    });
    assert.deepEqual(dictToJSON(d), { segment: { mali: '마리' }, whole: { 'aphu-n': '아프-ㄴ' } });
    assert.deepEqual(dictToJSON(dictFromJSON('broken')), { segment: {}, whole: {} });
    assert.deepEqual(dictToJSON(dictFromJSON(JSON.parse('{"segment":{"__proto__":"x"}}'))).segment, {});
  });

  test('dictFromJSON: 첫 배포 때의 키 이름(morphemes = 구간 일치, words = 전체 일치)도 읽는다', () => {
    const d = dictFromJSON({ v: 1, words: { 'ki-ka': '키-가' }, morphemes: { mali: '마리' } });
    assert.deepEqual(dictToJSON(d), { segment: { mali: '마리' }, whole: { 'ki-ka': '키-가' } });
  });

  test('applyChange: 바뀐 것이 없으면 같은 객체 (엔진 캐시 유지)', () => {
    const d = dict({}, { mali: '마리' });
    assert.equal(applyChange(d, { add: [{ scope: 'segment', key: 'mali', value: '마리' }] }), d);
    assert.equal(applyChange(d, { remove: [{ scope: 'whole', key: 'mali' }] }), d);
    const next = applyChange(d, { remove: [{ scope: 'segment', key: 'mali' }] });
    assert.notEqual(next, d);
    assert.equal(next.segment.size, 0);
    assert.equal(d.segment.size, 1); // 원본 불변
  });

  test('mergeDicts: 뒤쪽(이번 세션) 항목이 우선', () => {
    const merged = mergeDicts(dict({}, { mali: '마리', ku: '그' }), dict({}, { mali: '머리' }));
    assert.deepEqual(dictToJSON(merged).segment, { mali: '머리', ku: '그' });
    const only = dict({}, { a: '아' });
    assert.equal(mergeDicts(only, EMPTY_DICT), only);
  });

  test('entriesUsedIn: 입력 변환에 실제로 쓰인 항목만', () => {
    const d = dict({ 'mali-ka': '마리-가', 'aphu-n': '아프-ㄴ' }, { tuli: '드리', mali: '머리', ka: '까' });
    assert.deepEqual(dictToJSON(entriesUsedIn('tuli-ess-ta Mali-ka (ku) 1992', d)), {
      segment: { tuli: '드리' },
      whole: { 'mali-ka': '마리-가' }, // Mali-ka 안의 mali·ka는 전체 일치 항목에 가려 쓰이지 않음
    });
  });
});
