// 공유 URL은 #s= (프래그먼트)로 만든다 (2026-11-12)
// ?s= 는 서버로 전송되어, 입력이 길면(URL 약 1만 자 초과) 호스팅이 414 URI Too Long으로 거절했다.
// 프래그먼트는 서버로 가지 않는다. 예전에 공유된 ?s= 링크는 계속 열려야 한다
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildShareUrl, decodeShareState, encodeShareState } from '../src/lib/url-codec.ts';

const share = { d: 'h2y', i: '철수가 학교에 갔다', l: true, s: '', se: false, il: true, f: 'plain', n: false };

describe('decodeShareState — #s= 와 ?s=', () => {
  test('#s= 를 읽는다', () => {
    assert.deepEqual(decodeShareState('', '#s=' + encodeShareState(share)), share);
  });

  test('예전 ?s= 링크도 그대로 읽는다', () => {
    assert.deepEqual(decodeShareState('?s=' + encodeShareState(share), ''), share);
    assert.deepEqual(decodeShareState('?s=' + encodeShareState(share)), share);
  });

  test('둘 다 있으면 #s= 가 우선', () => {
    const other = { ...share, i: '다른 입력' };
    assert.deepEqual(decodeShareState('?s=' + encodeShareState(other), '#s=' + encodeShareState(share)), share);
  });

  test('s가 없는 프래그먼트·깨진 데이터는 null', () => {
    assert.equal(decodeShareState('', ''), null);
    assert.equal(decodeShareState('', '#top'), null);
    assert.equal(decodeShareState('', '#s=%%%'), null);
  });
});

describe('buildShareUrl', () => {
  const saved = Object.getOwnPropertyDescriptor(globalThis, 'location');
  before(() => {
    Object.defineProperty(globalThis, 'location', {
      value: { origin: 'https://example.test', pathname: '/app/' },
      configurable: true,
    });
  });
  after(() => {
    if (saved) Object.defineProperty(globalThis, 'location', saved);
    else delete globalThis.location;
  });

  test('데이터는 프래그먼트에만 — 서버로 가는 부분에는 없다', () => {
    const url = new URL(buildShareUrl(share));
    assert.equal(url.origin + url.pathname, 'https://example.test/app/');
    assert.equal(url.search, '');
    assert.deepEqual(decodeShareState(url.search, url.hash), share);
  });

  test('입력이 길어도 서버로 가는 부분의 길이는 그대로', () => {
    const long = { ...share, i: '철수가 학교에 갔다 '.repeat(5000) };
    const url = new URL(buildShareUrl(long));
    assert.equal(url.search, '');
    assert.ok(url.hash.length > 100_000);
    assert.deepEqual(decodeShareState(url.search, url.hash), long);
  });
});
