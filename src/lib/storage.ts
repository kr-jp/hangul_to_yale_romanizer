// localStorage 영속화 + 히스토리 CRUD — src/ui/state.js의 완전 이식 (설계 문서 §2.2)
// 키·검증·직렬화 형식을 바이트 단위로 동일하게 유지한다 (기존 사용자 데이터 보호)
import type { ConvertOpts, HistoryItem, Lang, OutputFormat, Theme } from './types';

export const KEYS = {
  history: 'yaleHistoryV1',
  theme: 'yaleThemeV1',
  lang: 'yaleLangV1',
  format: 'yaleFormatV1',
  tabCopy: 'yaleTabCopyV1',
} as const;

// 'gloss'(TSV)는 UI에서 제거됨(2026-06-12) — 구버전 localStorage·공유 URL의 'gloss'는 plain으로 폴백
const VALID_FORMATS = new Set<string>(['plain', 'latex', 'markdown']);
const VALID_LANGS = new Set<string>(['ja', 'ko']);
const VALID_THEMES = new Set<string>(['dark', 'light']);

const HIST_MAX = 50;

function readSaved<T extends string>(key: string, valid: Set<string>, fallback: T): T {
  const v = localStorage.getItem(key);
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
  localStorage.setItem(KEYS.theme, theme);
}

export function readLang(): Lang {
  return readSaved<Lang>(KEYS.lang, VALID_LANGS, 'ja');
}

export function writeLang(lang: Lang): void {
  if (!VALID_LANGS.has(lang)) return;
  localStorage.setItem(KEYS.lang, lang);
}

export function readFormat(): OutputFormat {
  return readSaved<OutputFormat>(KEYS.format, VALID_FORMATS, 'plain');
}

export function writeFormat(fmt: OutputFormat): void {
  if (!VALID_FORMATS.has(fmt)) return;
  localStorage.setItem(KEYS.format, fmt);
}

// タブ区切り(복사 시 공백→탭 치환) 설정 — 기본 ON. 취향 설정이라 영속화 (2026-06-12)
export function readTabCopy(): boolean {
  return localStorage.getItem(KEYS.tabCopy) !== 'off';
}

export function writeTabCopy(on: boolean): void {
  localStorage.setItem(KEYS.tabCopy, on ? 'on' : 'off');
}

// ===== 히스토리 =====
// 구버전 데이터에 tags가 없을 수 있음 → 읽기 측은 항상 (h.tags || [])로 방어
export function loadHistory(): HistoryItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEYS.history) || '[]') as unknown;
    // 손상된 저장값(비배열 JSON)이 .sort 크래시로 이어지지 않게 방어
    return Array.isArray(parsed) ? (parsed as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(arr: HistoryItem[]): void {
  localStorage.setItem(KEYS.history, JSON.stringify(arr));
}

export function addHistoryItem({ text, opts }: { text: string; opts: ConvertOpts }): void {
  const t = (text || '').trim();
  if (!t) return;
  const item: HistoryItem = {
    id: Date.now(),
    text: t,
    opts,
    ts: new Date().toISOString(),
    pinned: false,
    tags: [],
  };
  let hist = loadHistory();
  // 동일 텍스트+옵션 중복 제거하되, 기존 항목의 tags는 보존해서 재사용
  const existing = hist.find(
    (h) => h.text === item.text && JSON.stringify(h.opts) === JSON.stringify(item.opts),
  );
  if (existing) item.tags = existing.tags || [];
  hist = hist.filter(
    (h) => !(h.text === item.text && JSON.stringify(h.opts) === JSON.stringify(item.opts)),
  );
  const pinned = hist.filter((h) => h.pinned);
  const others = hist.filter((h) => !h.pinned);
  others.unshift(item);
  // 비pinned만 50개 초과분 꼬리 제거 (pinned는 상한 면제)
  while (others.length > HIST_MAX) others.pop();
  const next = [...pinned, ...others].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.id - a.id,
  );
  saveHistory(next);
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
