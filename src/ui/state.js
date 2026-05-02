// 앱 상태 + localStorage 영속화. DOM에는 의존하지 않는다
const KEYS = {
  history: 'yaleHistoryV1',
  theme: 'yaleThemeV1',
  lang: 'yaleLangV1',
  format: 'yaleFormatV1',
};

const VALID_FORMATS = new Set(['plain', 'gloss', 'latex', 'markdown']);
const VALID_LANGS = new Set(['ja', 'ko']);
const VALID_THEMES = new Set(['dark', 'light']);
const VALID_DIRS = new Set(['h2y', 'y2h']);

const HIST_MAX = 50;

function readSaved(key, valid, fallback) {
  const v = localStorage.getItem(key);
  return (v && valid.has(v)) ? v : fallback;
}

export const state = {
  conversionDir: 'h2y',
  currentLang: readSaved(KEYS.lang, VALID_LANGS, 'ja'),
  currentFormat: readSaved(KEYS.format, VALID_FORMATS, 'plain'),
  currentTheme: readSaved(KEYS.theme, VALID_THEMES, 'dark'),
};

export function setDirection(dir) {
  if (!VALID_DIRS.has(dir)) return;
  state.conversionDir = dir;
}

export function setLang(lang) {
  if (!VALID_LANGS.has(lang)) return;
  state.currentLang = lang;
  localStorage.setItem(KEYS.lang, lang);
}

export function setFormat(fmt) {
  if (!VALID_FORMATS.has(fmt)) return;
  state.currentFormat = fmt;
  localStorage.setItem(KEYS.format, fmt);
}

export function setTheme(theme) {
  if (!VALID_THEMES.has(theme)) return;
  state.currentTheme = theme;
  localStorage.setItem(KEYS.theme, theme);
}

// ===== 히스토리 =====
export function loadHistory() {
  try { return JSON.parse(localStorage.getItem(KEYS.history) || '[]'); }
  catch { return []; }
}

export function saveHistory(arr) {
  localStorage.setItem(KEYS.history, JSON.stringify(arr));
}

export function addHistoryItem({ text, opts }) {
  const t = (text || '').trim();
  if (!t) return;
  const item = {
    id: Date.now(),
    text: t,
    opts,
    ts: new Date().toISOString(),
    pinned: false,
    tags: [],
  };
  let hist = loadHistory();
  // 동일 텍스트+옵션 중복 제거하되, 기존 항목의 tags는 보존해서 재사용
  const existing = hist.find(h => h.text === item.text && JSON.stringify(h.opts) === JSON.stringify(item.opts));
  if (existing) item.tags = existing.tags || [];
  hist = hist.filter(h => !(h.text === item.text && JSON.stringify(h.opts) === JSON.stringify(item.opts)));
  const pinned = hist.filter(h => h.pinned);
  const others = hist.filter(h => !h.pinned);
  others.unshift(item);
  while (others.length > HIST_MAX) others.pop();
  const next = [...pinned, ...others].sort((a, b) => (b.pinned - a.pinned) || (b.id - a.id));
  saveHistory(next);
}

export function addTagToHistoryItem(id, tag) {
  const t = (tag || '').trim();
  if (!t) return;
  const hist = loadHistory();
  const item = hist.find(h => h.id === id);
  if (!item) return;
  if (!Array.isArray(item.tags)) item.tags = [];
  if (!item.tags.includes(t)) item.tags.push(t);
  saveHistory(hist);
}

export function removeTagFromHistoryItem(id, tag) {
  const hist = loadHistory();
  const item = hist.find(h => h.id === id);
  if (!item || !Array.isArray(item.tags)) return;
  item.tags = item.tags.filter(x => x !== tag);
  saveHistory(hist);
}

// 모든 태그 (중복 제거, 빈도순 정렬)
export function getAllTags() {
  const counts = new Map();
  for (const h of loadHistory()) {
    for (const t of (h.tags || [])) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}
