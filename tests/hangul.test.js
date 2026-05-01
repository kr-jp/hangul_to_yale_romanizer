import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isHangulSyllable, toJamo, composeHangul,
  CHOSEONG, JUNGSEONG, JONGSEONG,
} from '../src/converter/hangul.js';

describe('isHangulSyllable', () => {
  test('한글 완성형 음절 인식', () => {
    assert.equal(isHangulSyllable('가'), true);
    assert.equal(isHangulSyllable('한'), true);
    assert.equal(isHangulSyllable('힣'), true);
  });

  test('한글이 아닌 문자는 false', () => {
    assert.equal(isHangulSyllable('a'), false);
    assert.equal(isHangulSyllable('A'), false);
    assert.equal(isHangulSyllable('1'), false);
    assert.equal(isHangulSyllable('!'), false);
    assert.equal(isHangulSyllable('あ'), false);
    assert.equal(isHangulSyllable('ㄱ'), false); // 호환 자모는 음절이 아님
  });
});

describe('toJamo', () => {
  test('초성 ㅇ은 제거됨 (Yale 표기 규칙)', () => {
    assert.equal(toJamo('아'), 'ㅏ');
    assert.equal(toJamo('어'), 'ㅓ');
  });

  test('초성+중성 분해', () => {
    assert.equal(toJamo('가'), 'ㄱㅏ');
    assert.equal(toJamo('나'), 'ㄴㅏ');
  });

  test('초성+중성+종성 분해', () => {
    assert.equal(toJamo('한'), 'ㅎㅏㄴ');
    assert.equal(toJamo('국'), 'ㄱㅜㄱ');
  });

  test('겹받침은 두 자모로 분해', () => {
    assert.equal(toJamo('값'), 'ㄱㅏㅂㅅ'); // ㅄ → ㅂㅅ
    assert.equal(toJamo('닭'), 'ㄷㅏㄹㄱ'); // ㄺ → ㄹㄱ
    assert.equal(toJamo('앉'), 'ㅏㄴㅈ'); // 초성 ㅇ 생략, ㄵ → ㄴㅈ
  });

  test('한글이 아닌 문자는 그대로 보존', () => {
    assert.equal(toJamo('a'), 'a');
    assert.equal(toJamo('한a국'), 'ㅎㅏㄴaㄱㅜㄱ');
    assert.equal(toJamo('한국, 어'), 'ㅎㅏㄴㄱㅜㄱ, ㅓ');
  });

  test('빈 문자열', () => {
    assert.equal(toJamo(''), '');
  });
});

describe('composeHangul', () => {
  test('초성+중성', () => {
    assert.equal(composeHangul('ㅎ', 'ㅏ', null), '하');
    assert.equal(composeHangul('ㄱ', 'ㅏ', null), '가');
  });

  test('초성+중성+종성', () => {
    assert.equal(composeHangul('ㅎ', 'ㅏ', 'ㄴ'), '한');
    assert.equal(composeHangul('ㄱ', 'ㅜ', 'ㄱ'), '국');
  });

  test('겹받침 종성', () => {
    assert.equal(composeHangul('ㄱ', 'ㅏ', 'ㅄ'), '값');
    assert.equal(composeHangul('ㄷ', 'ㅏ', 'ㄺ'), '닭');
  });

  test('잘못된 자모는 빈 문자열', () => {
    assert.equal(composeHangul('?', 'ㅏ', null), '');
    assert.equal(composeHangul('ㄱ', '?', null), '');
  });
});

describe('자모 표 일관성', () => {
  test('초성/중성/종성 길이가 표준 unicode와 일치', () => {
    assert.equal(CHOSEONG.length, 19);
    assert.equal(JUNGSEONG.length, 21);
    assert.equal(JONGSEONG.length, 28); // 종성 없음 포함
  });

  test('JONGSEONG[0]은 빈 문자열 (종성 없음)', () => {
    assert.equal(JONGSEONG[0], '');
  });
});
