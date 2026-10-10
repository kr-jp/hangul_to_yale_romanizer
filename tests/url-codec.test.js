// 공유 URL 디코딩 테스트 (src/lib/url-codec.ts)
// 외부에서 온 값의 형태를 강제 — 잘못된 타입으로 렌더링 중 예외가 나 화면이 비던 문제 (2026-10-10)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { b64UrlEncode, decodeShareState, encodeShareState, sanitizeShareState } from '../src/lib/url-codec.ts';

const search = (obj) => '?s=' + b64UrlEncode(JSON.stringify(obj));

describe('decodeShareState', () => {
  test('정상 왕복 (구버전 키만 있는 URL 포함)', () => {
    const share = { d: 'y2h', i: 'hankwuk', l: true, s: '', se: false, il: true, f: 'latex', n: false };
    assert.deepEqual(decodeShareState('?s=' + encodeShareState(share)), share);
  });

  test('파라미터 없음·깨진 데이터는 null', () => {
    assert.equal(decodeShareState(''), null);
    assert.equal(decodeShareState('?s=%%%'), null);
    assert.equal(decodeShareState(search(42)), null);
    assert.equal(decodeShareState(search(['a'])), null);
  });

  test('문자열 필드에 다른 타입이 오면 빈 문자열', () => {
    const s = decodeShareState(search({ d: 'h2y', i: 123, s: { x: 1 } }));
    assert.equal(s.i, '');
    assert.equal(s.s, '');
  });
});

describe('sanitizeShareState', () => {
  test('override는 문자열 값만, 글로스는 배열만', () => {
    const s = sanitizeShareState({ o: { a: '가', b: 3 }, g: { line: ['x', 1, null], bad: 'x' } });
    assert.deepEqual(s.o, { a: '가' });
    assert.deepEqual(s.g, { line: ['x', '1', ''] });
  });

  test('선택 키 h·ge는 참일 때만', () => {
    assert.equal(sanitizeShareState({ h: 1, ge: true }).h, true);
    assert.equal('h' in sanitizeShareState({}), false);
  });

  test('사용자 사전 항목 u는 문자열 값만, 비면 생략 (s = 구간 일치, w = 전체 일치)', () => {
    const s = sanitizeShareState({ u: { w: { 'ki-ka': '키-가', x: 1 }, s: 'bad' } });
    assert.deepEqual(s.u, { w: { 'ki-ka': '키-가' } });
    assert.equal('u' in sanitizeShareState({ u: { w: { x: 1 } } }), false);
    assert.equal('u' in sanitizeShareState({ u: [] }), false);
  });

  test('첫 배포 때 링크의 m(구간 일치의 옛 이름)은 s로', () => {
    assert.deepEqual(sanitizeShareState({ u: { m: { mali: '마리' } } }).u, { s: { mali: '마리' } });
    assert.deepEqual(sanitizeShareState({ u: { m: { mali: '마리' }, s: { mali: '머리' } } }).u, { s: { mali: '머리' } });
  });
});
