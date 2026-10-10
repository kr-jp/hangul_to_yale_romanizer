// 공용 타입 (설계 문서 §0)

export type Direction = 'h2y' | 'y2h';
export type OutputFormat = 'plain' | 'gloss' | 'latex' | 'markdown';
export type Lang = 'ja' | 'ko';
export type Theme = 'light' | 'dark';

// 변환 엔진에 넘기는 형식. keepHyphens는 y2h 전용 표시 설정이라 히스토리에는 저장하지 않는다
export interface ConvertOpts {
  sep: string;
  labial: boolean;
  keepHyphens?: boolean;
}

// 히스토리에 저장하는 옵션 (이 키명·순서 그대로 — 히스토리 dedup이 JSON.stringify 비교)
export interface HistoryOpts {
  sep: string;
  labial: boolean;
}

export interface HistoryItem {
  id: number; // Date.now() — 식별자 겸 생성 시각 (표시: new Date(id).toLocaleString())
  text: string; // trim()된 입력 전문
  opts: HistoryOpts;
  direction?: Direction; // 2026-10 추가 — 구버전 항목은 없음 (텍스트로 추정, storage.historyDirection)
  ts: string; // ISO 8601 마지막 갱신 시각 (편집 세션 판정용, 정렬에는 미사용)
  pinned: boolean;
  tags: string[];
}

export interface Example {
  tokens: string[];
  romas: string[];
}

// parseYaleWordCandidates 반환 요소
export interface YaleCandidate {
  hangul: string;
  score: number;
}

// URL ?s= 의 JSON shape — 키명 1글자 그대로 유지 (§3)
// ge/g는 Stage 5 신규 선택 키 — 부재 시 off/빈 Map (기존 URL 완전 호환)
export interface ShareState {
  d: Direction;
  i: string;
  l: boolean;
  s: string;
  se: boolean;
  il: boolean;
  f: OutputFormat;
  n: boolean;
  o?: Record<string, string>;
  ge?: boolean; // glossEnabled. false면 생략
  g?: Record<string, string[]>; // 글로스 (줄 텍스트 → 셀 배열). 비면 생략
  h?: boolean; // keepHyphens (y2h 형태소 경계 '-' 표시). false면 생략
}
