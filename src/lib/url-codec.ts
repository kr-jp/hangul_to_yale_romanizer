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
    return sanitizeShareState(JSON.parse(b64UrlDecode(s)));
  } catch (err) {
    console.warn('[Yale] URL 공유 데이터 파싱 실패:', err);
    return null;
  }
}

// 외부에서 온 값이므로 형태를 강제한다 — 문자열이어야 할 i·s가 숫자 등이면 렌더링 중 예외로 화면이 비던 문제.
// d·f의 값 검증(무효면 현재 설정 유지)은 APPLY_SHARE가 맡는다
export function sanitizeShareState(raw: unknown): ShareState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const isRecord = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === 'object' && !Array.isArray(v);
  const out: ShareState = {
    d: r.d as ShareState['d'],
    i: str(r.i),
    l: !!r.l,
    s: str(r.s),
    se: !!r.se,
    il: !!r.il,
    f: r.f as ShareState['f'],
    n: !!r.n,
  };
  if (isRecord(r.o)) {
    out.o = Object.fromEntries(Object.entries(r.o).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  }
  if (r.ge) out.ge = true;
  if (isRecord(r.g)) {
    const g: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(r.g)) if (Array.isArray(v)) g[k] = v.map((x) => String(x ?? ''));
    out.g = g;
  }
  if (r.h) out.h = true;
  // 사용자 사전 항목 (s = 구간 일치, w = 전체 일치) — 문자열 값만. 키·값의 Yale/한글 형식 검증은 dictFromJSON이
  // 적용 시점에. 첫 배포 때 링크의 m(구간 일치의 옛 이름)은 s로 옮긴다
  if (isRecord(r.u)) {
    const strings = (v: unknown) =>
      isRecord(v) ? (Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'string')) as Record<string, string>) : {};
    const s = { ...strings(r.u.m), ...strings(r.u.s) };
    const w = strings(r.u.w);
    if (Object.keys(s).length || Object.keys(w).length) {
      out.u = {};
      if (Object.keys(s).length) out.u.s = s;
      if (Object.keys(w).length) out.u.w = w;
    }
  }
  return out;
}

export function buildShareUrl(s: ShareState): string {
  return location.origin + location.pathname + '?s=' + encodeShareState(s);
}
