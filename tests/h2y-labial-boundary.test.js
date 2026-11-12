// 양순음 규칙의 적용 범위 — 같은 음절의 초성(ㅁㅂㅃㅍ) 뒤 ㅜ만 u로 쓴다 (2026-11-12)
// 초성 ㅇ은 Yale에서 생략되므로, 자모열 전체에 규칙을 적용하면 받침 ㅁ·ㅂ·ㅍ 뒤 음절의 '우'까지 u가 되어
// 삼우제 → samucey(= 사무제), 남우 → namu(= 나무)처럼 다른 단어와 같은 표기가 되던 문제
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { convert } from '../src/converter/h2y.js';

describe('양순음 규칙은 음절 경계를 넘지 않는다', () => {
  test('받침 ㅁ·ㅂ·ㅍ 뒤 음절의 우는 wu', () => {
    assert.equal(convert('삼우제'), 'samwucey');
    assert.equal(convert('남우'), 'namwu');
    assert.equal(convert('김우진'), 'kimwucin');
    assert.equal(convert('입우'), 'ipwu');
    assert.equal(convert('앞우'), 'aphwu');
  });

  test('겹받침이 양순음으로 끝나도 같다', () => {
    assert.equal(convert('삶우'), 'salmwu');
    assert.equal(convert('읊우'), 'ulphwu');
  });

  test('남우와 나무는 표기가 다르다', () => {
    assert.notEqual(convert('남우'), convert('나무'));
    assert.equal(convert('나무'), 'namu');
  });

  test('같은 음절의 초성 양순음 뒤 ㅜ는 종전대로 u', () => {
    assert.equal(convert('무'), 'mu');
    assert.equal(convert('붐'), 'pum');
    assert.equal(convert('뿌리'), 'ppuli');
    assert.equal(convert('풀'), 'phul');
    assert.equal(convert('삼무'), 'sammu');
  });

  test('분해형(NFD) 입력도 같은 결과', () => {
    assert.equal(convert('삼우제'.normalize('NFD')), 'samwucey');
  });

  test('구분자 옵션과 함께', () => {
    assert.equal(convert('삼우', { sep: '-' }), 's-a-m-wu');
  });

  test('양순음 규칙 OFF는 영향 없음', () => {
    assert.equal(convert('삼우제', { labial: false }), 'samwucey');
    assert.equal(convert('무', { labial: false }), 'mwu');
  });

  test('낱자모로 쓴 ㅂㅜ는 종전대로 규칙 적용', () => {
    assert.equal(convert('ㅂㅜ'), 'pu');
    assert.equal(convert('ㅁㅜ'), 'mu');
  });
});
