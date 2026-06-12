// URL 공유 인코딩/디코딩 — 원본 dom.js의 b64Url* 구현을 바이트 단위로 동일 재현 (설계 문서 §3)
// 기존에 공유된 URL이 새 버전에서도 그대로 열려야 한다
import type { ShareState } from './types';

export function b64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64UrlDecode(s: string): string {
  let std = s.replace(/-/g, '+').replace(/_/g, '/');
  while (std.length % 4) std += '=';
  const bin = atob(std);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeShareState(s: ShareState): string {
  return b64UrlEncode(JSON.stringify(s));
}

// ?s= 파라미터 디코딩. 없거나 파싱 실패 시 null (실패는 console.warn — 원본 동작)
export function decodeShareState(search: string): ShareState | null {
  const params = new URLSearchParams(search);
  const s = params.get('s');
  if (!s) return null;
  try {
    return JSON.parse(b64UrlDecode(s)) as ShareState;
  } catch (err) {
    console.warn('[Yale] URL 공유 데이터 파싱 실패:', err);
    return null;
  }
}

export function buildShareUrl(s: ShareState): string {
  return location.origin + location.pathname + '?s=' + encodeShareState(s);
}
