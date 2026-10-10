// 사용자 사전 학습·데이터 처리 테스트 (src/lib/user-dict.ts — Node의 TypeScript 타입 제거 기능으로 직접 import)
// - 2음절 이상 형태소·영어 이름 → 형태소 항목, 1음절 형태소·구간이 맞지 않는 입력 → 어절 항목
// - 엔진 결과로 되돌리면 항목 삭제, 바뀐 것이 없으면 변경 없음, 토큰의 구두점은 떼어 냄
// - 외부 데이터(저장소·파일·공유 URL) 정화, 실제로 쓰인 항목만 추출
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseYaleWordCandidates, setFrequencyData } from '../src/converter/y2h.js';
import {
  EMPTY_DICT, applyChange, describeToken, dictFromJSON, dictToJSON, entriesUsedIn, isEditableToken,
  learnCorrection, mergeDicts,
} from '../src/lib/user-dict.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dict = (words = {}, morphemes = {}) => ({
  words: new Map(Object.entries(words)),
  morphemes: new Map(Object.entries(morphemes)),
});
const opts = (d = null, extra = {}) => ({ sep: '', labial: true, keepHyphens: false, dict: d, ...extra });
const morpheme = (key, value) => ({ add: [{ scope: 'morphemes', key, value }], remove: [] });
const word = (key, value) => ({ add: [{ scope: 'words', key, value }], remove: [] });

describe('고친 결과 → 사전 항목 (learnCorrection)', () => {
  before(() => {
    const data = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'syllable-freq.json'), 'utf8'));
    setFrequencyData({ syllable: data.u, bigram: data.b, word: data.w });
  });
  after(() => setFrequencyData({}));

  test('후보 선택: 바뀐 2음절 형태소를 형태소 항목으로', () => {
    const pick = parseYaleWordCandidates('Mali-nun', opts()).find((c) => c.hangul === '마리는');
    assert.deepEqual(learnCorrection('Mali-nun', pick, opts()), morpheme('mali', '마리'));
  });

  test('직접 입력: 하이픈으로 나눈 형태는 형태소별로', () => {
    assert.deepEqual(learnCorrection('tuli-ess-ta', '드리-었-다', opts()), morpheme('tuli', '드리'));
  });

  test('1음절 형태소는 어절 항목 (표준 Yale과 충돌하기 쉬움)', () => {
    // 문헌 고유 표기를 고치는 경우: 키(표준 khi)를 ki로, 네(표준 ney)를 ne로 쓴 문헌.
    // 형태소로 기억하면 표준 Yale의 ki(기)·ne(너)까지 바뀌므로 그 어절에만
    assert.deepEqual(learnCorrection('ki-ka', '키-가', opts()), word('ki-ka', '키-가'));
    assert.deepEqual(learnCorrection('ne', '네', opts()), word('ne', '네'));
  });

  test('하이픈 없이 입력하면 어절 항목(값 그대로)', () => {
    assert.deepEqual(learnCorrection('aphu-n', '아픈', opts()), word('aphu-n', '아픈'));
  });

  test('변환되지 않던 구간(영어 이름)은 1음절이어도 형태소 항목', () => {
    assert.deepEqual(learnCorrection('John-un', '존-은', opts()), morpheme('john', '존'));
  });

  test('자음 형태소를 바꾸면 어절 항목', () => {
    assert.deepEqual(learnCorrection('ka-ss-ta', '가-었-다', opts()), word('ka-ss-ta', '가-었-다'));
  });

  test('토큰의 구두점·앞뒤 하이픈까지 입력해도 떼어 낸다', () => {
    assert.deepEqual(learnCorrection('kulemulo,', '그러므로,', opts()), morpheme('kulemulo', '그러므로'));
    assert.deepEqual(learnCorrection('-ko', '-구', opts()), word('ko', '구'));
  });

  test('바뀐 것이 없거나 받을 수 없는 값이면 null', () => {
    assert.equal(learnCorrection('tuli-ess-ta', '들이-었-다', opts()), null);
    assert.equal(learnCorrection('ka', '가 나', opts()), null); // 공백
    assert.equal(learnCorrection('ka', '   ', opts()), null);
    assert.equal(learnCorrection('123', '일이삼', opts()), null); // Yale run 없음
    assert.equal(learnCorrection('ka,na', '가나', opts()), null); // Yale run 둘
  });

  test('엔진 결과로 되돌리면 이 토큰에 쓰인 항목을 지운다', () => {
    const d = dict({}, { mali: '마리' });
    assert.deepEqual(learnCorrection('Mali-nun', '말이-는', opts(d)), {
      add: [],
      remove: [{ scope: 'morphemes', key: 'mali' }],
    });
    const base = parseYaleWordCandidates('Mali-nun', opts())[0];
    assert.deepEqual(learnCorrection('Mali-nun', base, opts(d)).remove, [{ scope: 'morphemes', key: 'mali' }]);
  });

  test('형태소 항목으로 고치면 그것을 가리던 어절 항목은 지운다', () => {
    const d = dict({ 'mali-nun': '마리-는' });
    assert.deepEqual(learnCorrection('Mali-nun', '머리-는', opts(d)), {
      add: [{ scope: 'morphemes', key: 'mali', value: '머리' }],
      remove: [{ scope: 'words', key: 'mali-nun' }],
    });
  });

  test('keepHyphens에서 고른 후보도 같은 항목', () => {
    const keep = opts(null, { keepHyphens: true });
    const pick = parseYaleWordCandidates('Mali-nun', keep).find((c) => c.hangul === '마리-는');
    assert.deepEqual(learnCorrection('Mali-nun', pick, keep), morpheme('mali', '마리'));
  });

  test('describeToken: 입력 칸 초기값은 하이픈으로 나눈 형태', () => {
    assert.deepEqual(describeToken('(Mali-nun,', opts()), {
      yale: 'Mali-nun', prefill: '말이-는', hits: [], segmented: true,
    });
    const d = dict({}, { mali: '마리' });
    assert.deepEqual(describeToken('Mali-ka', opts(d)).hits, [{ scope: 'morphemes', key: 'mali', value: '마리' }]);
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
      words: { 'Aphu-N': ' 아프-ㄴ ', 'ka ka': '가가', '-ko': '고', ok: 1 },
      morphemes: { mali: '마리', 'mali-nun': '마리는', __proto__x: '', empty: '', sp: '가 나', ['x'.repeat(3)]: '가'.repeat(61) },
    });
    assert.deepEqual(dictToJSON(d), { words: { 'aphu-n': '아프-ㄴ' }, morphemes: { mali: '마리' } });
    assert.deepEqual(dictToJSON(dictFromJSON('broken')), { words: {}, morphemes: {} });
    assert.deepEqual(dictToJSON(dictFromJSON(JSON.parse('{"morphemes":{"__proto__":"x"}}'))).morphemes, {});
  });

  test('applyChange: 바뀐 것이 없으면 같은 객체 (엔진 캐시 유지)', () => {
    const d = dict({}, { mali: '마리' });
    assert.equal(applyChange(d, { add: [{ scope: 'morphemes', key: 'mali', value: '마리' }] }), d);
    assert.equal(applyChange(d, { remove: [{ scope: 'words', key: 'mali' }] }), d);
    const next = applyChange(d, { remove: [{ scope: 'morphemes', key: 'mali' }] });
    assert.notEqual(next, d);
    assert.equal(next.morphemes.size, 0);
    assert.equal(d.morphemes.size, 1); // 원본 불변
  });

  test('mergeDicts: 뒤쪽(이번 세션) 항목이 우선', () => {
    const merged = mergeDicts(dict({}, { mali: '마리', ku: '그' }), dict({}, { mali: '머리' }));
    assert.deepEqual(dictToJSON(merged).morphemes, { mali: '머리', ku: '그' });
    const only = dict({}, { a: '아' });
    assert.equal(mergeDicts(only, EMPTY_DICT), only);
  });

  test('entriesUsedIn: 입력 변환에 실제로 쓰인 항목만', () => {
    const d = dict({ 'mali-ka': '마리-가', 'aphu-n': '아프-ㄴ' }, { tuli: '드리', mali: '머리', ka: '까' });
    assert.deepEqual(dictToJSON(entriesUsedIn('tuli-ess-ta Mali-ka (ku) 1992', d)), {
      words: { 'mali-ka': '마리-가' }, // Mali-ka 안의 mali·ka는 어절 항목에 가려 쓰이지 않음
      morphemes: { tuli: '드리' },
    });
  });
});
