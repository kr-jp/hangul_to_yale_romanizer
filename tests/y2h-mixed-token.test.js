// 비-Yale·혼합 토큰 보존 테스트 (2026-06-12 수정)
// 배포본(e6d8a3b 이후)의 기존 버그: parseYaleWordCandidates가
// (1) Yale 글자가 전혀 없는 토큰('123', '?')에서 빈 배열을 반환해 토큰이 출력에서 소실되고,
// (2) 내부 구두점으로 Yale run이 나뉜 토큰('ka,na')에서 첫 run만 변환했다.
// 수정: (1) 원형 그대로 후보 1개 반환, (2) 모든 run을 결정론 변환해 제자리 치환.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseYaleWordCandidates } from '../src/converter/y2h.js';

describe('비-Yale 토큰 보존 (탐욕 폴백)', () => {
  test('숫자 토큰은 원형 보존', () => {
    assert.deepEqual(parseYaleWordCandidates('123'), [{ hangul: '123', score: 0 }]);
  });

  test('기호·이모지 토큰은 원형 보존', () => {
    assert.deepEqual(parseYaleWordCandidates('?'), [{ hangul: '?', score: 0 }]);
    assert.deepEqual(parseYaleWordCandidates('★'), [{ hangul: '★', score: 0 }]);
  });

  test('빈 문자열은 빈 배열 유지', () => {
    assert.deepEqual(parseYaleWordCandidates(''), []);
  });
});

describe('혼합 토큰 (내부 구두점으로 나뉜 복수 run)', () => {
  test('쉼표로 나뉜 두 run 모두 변환', () => {
    const c = parseYaleWordCandidates('ka,na');
    assert.equal(c.length, 1);
    assert.equal(c[0].hangul, '가,나');
  });

  test('복수 run + 어말 마침표', () => {
    const c = parseYaleWordCandidates('ka,na.');
    assert.equal(c[0].hangul, '가,나.');
  });

  test('단일 run + prefix/suffix는 기존 동작 유지 (후보 분기 가능 경로)', () => {
    const c = parseYaleWordCandidates('(ka)');
    assert.equal(c.length, 1);
    assert.equal(c[0].hangul, '(가)');
  });
});
