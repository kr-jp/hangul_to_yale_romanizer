import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { convert, applyLabialRule, joinWithSep, tokenizeYale } from '../src/converter/h2y.js';

describe('convert (한글 → Yale)', () => {
  test('기본 단어', () => {
    assert.equal(convert('한국어'), 'hankwuke');
    assert.equal(convert('안녕하세요'), 'annyenghaseyyo');
    assert.equal(convert('학교'), 'hakkyo');
  });

  test('빈 입력', () => {
    assert.equal(convert(''), '');
    assert.equal(convert('   '), '');
    assert.equal(convert(null), '');
  });

  test('양순음 규칙 ON: ㅁㅂㅃㅍ 뒤 ㅜ → 표기 u', () => {
    assert.equal(convert('부'), 'pu'); // ㅂ + ㅜ → pu (ㅡ로 처리됨)
    assert.equal(convert('무'), 'mu');
    assert.equal(convert('푸'), 'phu');
  });

  test('양순음 규칙 OFF: ㅜ → wu 그대로', () => {
    assert.equal(convert('부', { labial: false }), 'pwu');
    assert.equal(convert('무', { labial: false }), 'mwu');
    assert.equal(convert('푸', { labial: false }), 'phwu');
  });

  test('양순음 아닌 자음 뒤 ㅜ는 wu 유지', () => {
    assert.equal(convert('수'), 'swu');
    assert.equal(convert('두'), 'twu');
    assert.equal(convert('구'), 'kwu');
  });

  test('겹받침 분해', () => {
    assert.equal(convert('값'), 'kaps');
    assert.equal(convert('닭'), 'talk');
    assert.equal(convert('앉'), 'anc'); // ㄵ → nc
  });

  test('초성 ㅇ 묵음', () => {
    assert.equal(convert('아'), 'a');
    assert.equal(convert('어'), 'e');
    assert.equal(convert('이'), 'i');
  });

  test('구분자 옵션 (자모 단위, ㅜ는 wu 한 토큰)', () => {
    assert.equal(convert('한국', { sep: '-' }), 'h-a-n-k-wu-k');
    assert.equal(convert('한국', { sep: '.' }), 'h.a.n.k.wu.k');
  });

  test('구분자는 자모 사이에만 — 공백/문장부호 양옆에는 들어가지 않음', () => {
    const out = convert('한 국', { sep: '-' });
    assert.equal(out, 'h-a-n k-wu-k');
  });

  test('한글이 아닌 문자는 그대로 보존', () => {
    assert.equal(convert('한국!'), 'hankwuk!');
    assert.equal(convert('한, 국'), 'han, kwuk');
    assert.equal(convert('123한'), '123han');
  });

  test('한글 + 영문 혼합', () => {
    assert.equal(convert('한국 OK'), 'hankwuk OK');
  });
});

describe('applyLabialRule', () => {
  test('양순음+ㅜ → 양순음+ㅡ', () => {
    assert.equal(applyLabialRule('ㅂㅜ'), 'ㅂㅡ');
    assert.equal(applyLabialRule('ㅁㅜ'), 'ㅁㅡ');
    assert.equal(applyLabialRule('ㅃㅜ'), 'ㅃㅡ');
    assert.equal(applyLabialRule('ㅍㅜ'), 'ㅍㅡ');
  });

  test('양순음 외 자음+ㅜ는 변하지 않음', () => {
    assert.equal(applyLabialRule('ㅅㅜ'), 'ㅅㅜ');
    assert.equal(applyLabialRule('ㄱㅜ'), 'ㄱㅜ');
    assert.equal(applyLabialRule('ㄴㅜ'), 'ㄴㅜ');
  });

  test('양순음 + 다른 모음은 변하지 않음', () => {
    assert.equal(applyLabialRule('ㅂㅏ'), 'ㅂㅏ');
    assert.equal(applyLabialRule('ㅁㅗ'), 'ㅁㅗ');
  });
});

describe('tokenizeYale + joinWithSep', () => {
  test('자모만 있을 때 sep 삽입', () => {
    const tokens = tokenizeYale('ㅎㅏㄴ');
    assert.equal(joinWithSep(tokens, '-'), 'h-a-n');
  });

  test('공백 양옆에는 sep 미삽입', () => {
    const tokens = tokenizeYale('ㅎㅏㄴ ㄱㅜㄱ');
    assert.equal(joinWithSep(tokens, '-'), 'h-a-n k-wu-k');
  });

  test('sep 없으면 그대로 결합', () => {
    const tokens = tokenizeYale('ㅎㅏㄴ');
    assert.equal(joinWithSep(tokens, ''), 'han');
  });
});
