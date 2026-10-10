// 공용 타입 (설계 문서 §0)

export type Direction = 'h2y' | 'y2h';
export type OutputFormat = 'plain' | 'gloss' | 'latex' | 'markdown';
export type Lang = 'ja' | 'ko';
export type Theme = 'light' | 'dark';

// 사용자 사전 (src/lib/user-dict.ts). 키는 소문자 Yale
// words = 어절의 Yale 부분 전체가 일치할 때, morphemes = '-'·'.'로 나뉜 구간 하나가 일치할 때
export type DictScope = 'words' | 'morphemes';
export interface UserDict {
  readonly words: ReadonlyMap<string, string>;
  readonly morphemes: ReadonlyMap<string, string>;
}

export interface DictEntry {
  scope: DictScope;
  key: string;
  value: string;
}

// 사전 변경 — remove를 먼저 적용한 뒤 add
export interface DictChange {
  add: DictEntry[];
  remove: { scope: DictScope; key: string }[];
}

// 후보 창이 열릴 때 필요한 토큰 정보 (user-dict.ts describeToken)
export interface TokenEditInfo {
  yale: string; // 토큰의 Yale 본체 (원래 대소문자)
  prefill: string; // 직접 입력 칸의 초기값 — 구간이 여럿이면 '-'로 나눈 형태 (형태소 단위로 고칠 수 있게)
  hits: DictEntry[]; // 이 토큰에 쓰이고 있는 사전 항목
  segmented: boolean;
}

// 인터리니어의 어절 편집 창이 App에 요청하는 동작 (참조가 고정된 객체로 전달)
export interface WordEditor {
  describe(token: string): TokenEditInfo | null;
  correct(token: string, value: string | YaleCandidate, remember: boolean): void;
  remove(entry: { scope: DictScope; key: string }): void;
}

// 변환 엔진에 넘기는 형식. keepHyphens는 y2h 전용 표시 설정이라 히스토리에는 저장하지 않는다.
// dict(사용자 사전)도 y2h 전용 — h2y 변환은 무시
export interface ConvertOpts {
  sep: string;
  labial: boolean;
  keepHyphens?: boolean;
  dict?: UserDict | null;
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

// parseYaleWordCandidates 반환 요소. parts = Yale 구간별 출력 (사용자 사전 학습용 — 사전 문자열을
// 그대로 쓴 경우·변환 대상이 없는 토큰은 없음), dict = 사용자 사전 항목이 쓰였는지
export interface YaleCandidate {
  hangul: string;
  score: number;
  parts?: readonly string[] | null;
  dict?: boolean;
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
  // 입력에 쓰인 사용자 사전 항목 (w = 어절, m = 형태소). 받는 쪽에서는 이번 세션에만 적용. 없으면 생략
  u?: { w?: Record<string, string>; m?: Record<string, string> };
}
