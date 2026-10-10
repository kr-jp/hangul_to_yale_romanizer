// localStorage 영속화 + 히스토리 CRUD — src/ui/state.js의 완전 이식 (설계 문서 §2.2)
// 키·검증·직렬화 형식을 바이트 단위로 동일하게 유지한다 (기존 사용자 데이터 보호)
import type { Direction, HistoryItem, HistoryOpts, Lang, OutputFormat, Theme } from './types';

export const KEYS = {
  history: 'yaleHistoryV1',
  theme: 'yaleThemeV1',
  lang: 'yaleLangV1',
  format: 'yaleFormatV1',
  tabCopy: 'yaleTabCopyV1',
  keepHyphens: 'yaleKeepHyphenV1',
} as const;

// 'gloss'(TSV)는 UI에서 제거됨(2026-06-12) — 구버전 localStorage·공유 URL의 'gloss'는 plain으로 폴백
const VALID_FORMATS = new Set<string>(['plain', 'latex', 'markdown']);
const VALID_LANGS = new Set<string>(['ja', 'ko']);
const VALID_THEMES = new Set<string>(['dark', 'light']);

const HIST_MAX = 50;
// 이보다 긴 입력은 히스토리에 남기지 않는다 — localStorage(약 5MB) 보호. 대용량 파일 변환은 기록 대상이 아님
export const HIST_TEXT_MAX = 50_000;
// 같은 편집 세션으로 보는 최대 간격 — 이보다 오래 손대지 않았으면 새 항목
const SESSION_GAP_MS = 10 * 60 * 1000;

// localStorage 접근은 실패할 수 있다(저장소 차단·용량 초과) — 설정이 유지되지 않을 뿐 앱은 계속 동작
function getItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function readSaved<T extends string>(key: string, valid: Set<string>, fallback: T): T {
  const v = getItem(key);
  return v && valid.has(v) ? (v as T) : fallback;
}

export function isValidFormat(v: unknown): v is OutputFormat {
  return typeof v === 'string' && VALID_FORMATS.has(v);
}

export function readTheme(): Theme {
  return readSaved<Theme>(KEYS.theme, VALID_THEMES, 'light');
}

export function writeTheme(theme: Theme): void {
  if (!VALID_THEMES.has(theme)) return;
  setItem(KEYS.theme, theme);
}

export function readLang(): Lang {
  return readSaved<Lang>(KEYS.lang, VALID_LANGS, 'ja');
}

export function writeLang(lang: Lang): void {
  if (!VALID_LANGS.has(lang)) return;
  setItem(KEYS.lang, lang);
}

export function readFormat(): OutputFormat {
  return readSaved<OutputFormat>(KEYS.format, VALID_FORMATS, 'plain');
}

export function writeFormat(fmt: OutputFormat): void {
  if (!VALID_FORMATS.has(fmt)) return;
  setItem(KEYS.format, fmt);
}

// タブ区切り(복사 시 공백→탭 치환) 설정 — 기본 ON. 취향 설정이라 영속화 (2026-06-12)
export function readTabCopy(): boolean {
  return getItem(KEYS.tabCopy) !== 'off';
}

export function writeTabCopy(on: boolean): void {
  setItem(KEYS.tabCopy, on ? 'on' : 'off');
}

// y2h 형태소 경계 '-' 표시 — 기본 OFF (Yale을 바로 읽는 것이 주목적이므로 먹었다). 영속화 (2026-10-10)
export function readKeepHyphens(): boolean {
  return getItem(KEYS.keepHyphens) === 'on';
}

export function writeKeepHyphens(on: boolean): void {
  setItem(KEYS.keepHyphens, on ? 'on' : 'off');
}

// ===== 히스토리 =====
// 구버전 데이터에 tags·direction이 없을 수 있음 → 읽기 측은 (h.tags || [])·historyDirection(h)로 방어
export function loadHistory(): HistoryItem[] {
  try {
    const parsed = JSON.parse(getItem(KEYS.history) || '[]') as unknown;
    // 손상된 저장값(비배열 JSON)이 .sort 크래시로 이어지지 않게 방어
    return Array.isArray(parsed) ? (parsed as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

// 저장 실패(용량 초과 등) 시 고정하지 않은 가장 오래된 항목부터 줄여 재시도
export function saveHistory(arr: HistoryItem[]): void {
  let next = arr;
  while (!setItem(KEYS.history, JSON.stringify(next))) {
    const oldest = next.filter((h) => !h.pinned).pop();
    if (!oldest) {
      console.warn('[Yale] 히스토리를 저장하지 못했습니다');
      return;
    }
    next = next.filter((h) => h !== oldest);
  }
}

const byPinThenNewest = (a: HistoryItem, b: HistoryItem) =>
  Number(b.pinned) - Number(a.pinned) || b.id - a.id;

// 변환 방향. 방향을 저장하지 않던 구버전 항목은 텍스트로 추정 (한글이 있으면 h2y)
export function historyDirection(item: Pick<HistoryItem, 'text' | 'direction'>): Direction {
  if (item.direction === 'h2y' || item.direction === 'y2h') return item.direction;
  return /[ᄀ-ᇿ㄰-㆏가-힣]/.test(item.text) ? 'h2y' : 'y2h';
}

export interface HistoryDraft {
  text: string;
  opts: HistoryOpts;
  direction: Direction;
}

// 입력 기록 — 같은 편집 세션의 기록은 새 항목을 만들지 않고 그 항목을 갱신한다
// ('철수가', '철수가 학교에'처럼 타이핑 도중의 상태가 따로따로 쌓이던 문제 수정).
// sessionId = 이 세션에서 마지막으로 기록한 항목 id(없으면 null). 반환값을 다음 호출에 넘긴다.
// 세션은 결과를 사용한 시점(복사·다운로드·공유·방향 전환 등)에 호출 측이 null로 끊는다
export function recordHistory(draft: HistoryDraft, sessionId: number | null): number | null {
  const text = (draft.text || '').trim();
  if (!text) return null; // 입력을 비우면 세션 종료
  if (text.length > HIST_TEXT_MAX) return sessionId;
  const opts: HistoryOpts = { sep: draft.opts.sep, labial: draft.opts.labial };
  const now = Date.now();
  let hist = loadHistory();
  // id는 생성 시각이자 식별자 — 같은 밀리초에 두 항목이 생겨도 겹치지 않게
  let id = Math.max(now, hist.reduce((m, h) => Math.max(m, h.id), 0) + 1);
  const session = sessionId === null ? undefined : hist.find((h) => h.id === sessionId);
  if (session && continuesSession(session, text, draft.direction, now)) {
    // 뒤에서부터 지우는 중이면 긴 쪽(직전 기록)을 남긴다
    if (session.text.startsWith(text)) return session.id;
    hist = hist.filter((h) => h !== session);
    id = session.id;
  }
  // 같은 텍스트·옵션·방향의 기존 항목은 하나로 합치되 핀·태그는 이어받는다
  const optsKey = JSON.stringify(opts);
  const same = (h: HistoryItem) =>
    h.text === text && historyDirection(h) === draft.direction && JSON.stringify(h.opts) === optsKey;
  const existing = hist.find(same);
  hist = hist.filter((h) => !same(h));
  const item: HistoryItem = {
    id,
    text,
    opts,
    direction: draft.direction,
    ts: new Date(now).toISOString(),
    pinned: existing?.pinned ?? false,
    tags: existing?.tags || [],
  };
  const pinned = hist.filter((h) => h.pinned);
  const others = hist.filter((h) => !h.pinned);
  (item.pinned ? pinned : others).unshift(item);
  // 비pinned만 50개 초과분 꼬리 제거 (pinned는 상한 면제)
  while (others.length > HIST_MAX) others.pop();
  saveHistory([...pinned, ...others].sort(byPinThenNewest));
  return item.id;
}

// 세션 항목을 이어서 갱신해도 되는가 — 사용자가 고정·태그한 항목은 건드리지 않고,
// 전혀 다른 텍스트(전체 선택 후 새로 입력 등)면 새 항목으로 남긴다
function continuesSession(h: HistoryItem, text: string, direction: Direction, now: number): boolean {
  if (h.pinned || (h.tags || []).length > 0) return false;
  if (historyDirection(h) !== direction) return false;
  const last = Date.parse(h.ts);
  if (!Number.isFinite(last) || now - last > SESSION_GAP_MS) return false;
  return sharedEdgeLength(h.text, text) * 2 >= Math.min(h.text.length, text.length);
}

// 두 문자열의 공통 접두사 + 공통 접미사 길이 (겹치지 않게)
function sharedEdgeLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let p = 0;
  while (p < max && a[p] === b[p]) p++;
  let s = 0;
  while (s < max - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return p + s;
}

export function addTagToHistoryItem(id: number, tag: string): void {
  const t = (tag || '').trim();
  if (!t) return;
  const hist = loadHistory();
  const item = hist.find((h) => h.id === id);
  if (!item) return;
  if (!Array.isArray(item.tags)) item.tags = [];
  if (!item.tags.includes(t)) item.tags.push(t);
  saveHistory(hist);
}

export function removeTagFromHistoryItem(id: number, tag: string): void {
  const hist = loadHistory();
  const item = hist.find((h) => h.id === id);
  if (!item || !Array.isArray(item.tags)) return;
  item.tags = item.tags.filter((x) => x !== tag);
  saveHistory(hist);
}

// 모든 태그 (중복 제거, 빈도 내림차순 정렬)
export function getAllTags(): string[] {
  const counts = new Map<string, number>();
  for (const h of loadHistory()) {
    for (const t of h.tags || []) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}
