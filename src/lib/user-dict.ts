// 사용자 사전 — 후보 창에서 고르거나 직접 입력한 변환을 기억해 Yale→한글 변환에 우선 적용한다 (2026-10)
//  - morphemes(형태소): '-'·'.'로 나뉜 구간 하나가 키와 같으면 그 구간을 값으로
//    (mali → 마리면 Mali-nun, Mali-ka 모두 적용)
//  - words(어절): 어절의 Yale 부분 전체가 키와 같을 때만. 값이 구간 수만큼 '-'로 나뉘어 있으면 구간별 값
//    (하이픈 표시·종성 결합은 평소대로), 아니면 값 문자열 그대로
// 키는 소문자 Yale. 실제 적용은 엔진(y2h.js rankRun)이 opts.dict로 받아서 한다
import { analyzeToken, parseYaleWordCandidates, yaleRunsIn } from '../converter/y2h.js';
import type { ConvertOpts, DictChange, DictEntry, DictScope, TokenEditInfo, UserDict, YaleCandidate } from './types';

export const EMPTY_DICT: UserDict = { words: new Map(), morphemes: new Map() };

// 어절 키는 본체 그대로(내부 '-'·'.' 허용), 형태소 키는 구간 하나
const KEY_PATTERN: Record<DictScope, RegExp> = {
  words: /^[a-z](?:[a-z.-]*[a-z])?$/,
  morphemes: /^[a-z]+$/,
};
export const VALUE_MAX = 60;

export const normalizeKey = (yale: string) => yale.trim().toLowerCase();
export const normalizeValue = (value: string) => value.normalize('NFC').trim();
export const isValidKey = (scope: DictScope, key: string) => KEY_PATTERN[scope].test(key);
// 공백이 들어가면 어절 수가 달라져 인터리니어·글로스 정렬이 깨지므로 받지 않는다
export const isValidValue = (value: string) => value.length > 0 && value.length <= VALUE_MAX && !/\s/.test(value);

export function dictSize(d: UserDict): number {
  return d.words.size + d.morphemes.size;
}

// 표시용 목록 — 키 순, 같은 키는 형태소가 먼저
export function entriesOf(d: UserDict): DictEntry[] {
  const out: DictEntry[] = [];
  for (const [key, value] of d.morphemes) out.push({ scope: 'morphemes', key, value });
  for (const [key, value] of d.words) out.push({ scope: 'words', key, value });
  return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.scope === 'morphemes' ? -1 : 1));
}

// over의 항목이 base보다 우선 (이번 세션 항목 > 저장된 사전)
export function mergeDicts(base: UserDict, over: UserDict): UserDict {
  if (!dictSize(over)) return base;
  if (!dictSize(base)) return over;
  return {
    words: new Map([...base.words, ...over.words]),
    morphemes: new Map([...base.morphemes, ...over.morphemes]),
  };
}

// 바뀐 것이 없으면 같은 객체를 돌려준다 — 사전 객체가 바뀌면 엔진의 run 캐시도 새로 만들어지므로
export function applyChange(d: UserDict, change: Partial<DictChange>): UserDict {
  const remove = (change.remove ?? []).filter((r) => d[r.scope].has(r.key));
  const add = (change.add ?? []).filter((a) => d[a.scope].get(a.key) !== a.value || remove.some((r) => r.scope === a.scope && r.key === a.key));
  if (!remove.length && !add.length) return d;
  const next = { words: new Map(d.words), morphemes: new Map(d.morphemes) };
  for (const r of remove) next[r.scope].delete(r.key);
  for (const a of add) next[a.scope].set(a.key, a.value);
  return next;
}

export function dictToJSON(d: UserDict): { words: Record<string, string>; morphemes: Record<string, string> } {
  return { words: Object.fromEntries(d.words), morphemes: Object.fromEntries(d.morphemes) };
}

// 외부에서 온 값(저장소·파일·공유 URL) → 유효한 항목만 남긴 사전
export function dictFromJSON(raw: unknown): UserDict {
  const out = { words: new Map<string, string>(), morphemes: new Map<string, string>() };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const scope of ['words', 'morphemes'] as const) {
    const src = (raw as Record<string, unknown>)[scope];
    if (!src || typeof src !== 'object' || Array.isArray(src)) continue;
    for (const [k, v] of Object.entries(src)) {
      if (typeof v !== 'string') continue;
      const key = normalizeKey(k);
      const value = normalizeValue(v);
      if (isValidKey(scope, key) && isValidValue(value)) out[scope].set(key, value);
    }
  }
  return out;
}

// 텍스트 변환에 실제로 쓰이는 항목만 (공유 URL·백업에 넣어 같은 결과를 재현하기 위함)
export function entriesUsedIn(text: string, dict: UserDict): UserDict {
  const out = { words: new Map<string, string>(), morphemes: new Map<string, string>() };
  if (!dictSize(dict)) return out;
  for (const run of yaleRunsIn(text)) {
    const word = dict.words.get(run.key);
    if (word !== undefined) {
      out.words.set(run.key, word);
      continue;
    }
    run.segments.forEach((seg: string, i: number) => {
      const value = run.vowel[i] ? dict.morphemes.get(seg) : undefined;
      if (value !== undefined) out.morphemes.set(seg, value);
    });
  }
  return out;
}

type TokenInfo = NonNullable<ReturnType<typeof analyzeToken>>;

// 이 토큰에 적용되고 있는 사전 항목 (어절 항목이 있으면 형태소 항목은 쓰이지 않는다)
function hitsFor(info: TokenInfo, dict: UserDict | null | undefined): DictEntry[] {
  if (!dict) return [];
  const word = dict.words.get(info.key);
  if (word !== undefined) return [{ scope: 'words', key: info.key, value: word }];
  const out: DictEntry[] = [];
  info.segments.forEach((seg: string, i: number) => {
    const value = info.vowel[i] ? dict.morphemes.get(seg) : undefined;
    if (value !== undefined && !out.some((e) => e.key === seg)) out.push({ scope: 'morphemes', key: seg, value });
  });
  return out;
}

// 후보의 한글 중 Yale 본체에 해당하는 부분 (토큰 앞뒤 구두점과 run 앞뒤 '-'·'.' 제외)
function coreText(c: YaleCandidate, info: TokenInfo): string {
  const start = info.prefix.length + info.lead.length;
  const end = c.hangul.length - info.suffix.length - info.tail.length;
  return c.hangul.slice(start, Math.max(start, end));
}

const syllableCount = (s: string) => (s.match(/[가-힣]/g) || []).length;
const sameParts = (a: readonly string[], b: readonly string[] | null | undefined) =>
  !!b && a.length === b.length && a.every((x, i) => x === b[i]);

// 고칠 수 있는 토큰인지 — Yale run이 정확히 1개이고 본체가 있을 때 (구두점만·숫자·복수 run은 아님)
export const isEditableToken = (token: string) => !!analyzeToken(token);

// 후보 창이 열릴 때 필요한 정보. 고칠 수 없는 토큰은 null
export function describeToken(token: string, opts: ConvertOpts): TokenEditInfo | null {
  const info = analyzeToken(token);
  if (!info) return null;
  const cur = parseYaleWordCandidates(token, opts, 1)[0];
  if (!cur) return null;
  const start = info.prefix.length + info.lead.length;
  return {
    yale: token.slice(start, token.length - info.suffix.length - info.tail.length),
    prefill: cur.parts && cur.parts.length === info.segments.length ? cur.parts.join('-') : coreText(cur, info),
    hits: hitsFor(info, opts.dict),
    segmented: info.segments.length > 1,
  };
}

// 고친 결과 → 사전 변경. value = 후보 창에서 고른 후보, 또는 직접 입력한 문자열(Yale 본체 부분의 한글).
// - 엔진 결과(사전 없이)로 되돌린 것이면 이 토큰에 쓰인 항목을 지운다
// - 구간별로 맞출 수 있고, 바뀐 구간이 모두 2음절 이상이거나 원래 변환되지 않던 구간(John 등)이면
//   형태소 항목으로 — 다른 어절에서도 쓰인다. 1음절 형태소는 표준 Yale과 충돌하기 쉬워 어절 항목으로
//   (khi(키)를 ki로 쓰는 문헌의 ki → 키를 형태소로 기억하면 표준 Yale의 ki(기)까지 바뀐다)
// - 그 밖(구간 수가 다르게 입력, 자음 형태소를 바꿈 등)은 어절 항목
// 바뀐 것이 없으면 null
export function learnCorrection(
  token: string,
  value: string | YaleCandidate,
  opts: ConvertOpts,
): DictChange | null {
  const info = analyzeToken(token);
  if (!info) return null;
  const n = info.segments.length;
  const cur = parseYaleWordCandidates(token, opts, 1)[0];
  const base = parseYaleWordCandidates(token, { ...opts, dict: null }, 1)[0];
  if (!cur || !base) return null;
  const hits = hitsFor(info, opts.dict);
  const revert: DictChange | null = hits.length
    ? { add: [], remove: hits.map(({ scope, key }) => ({ scope, key })) }
    : null;

  let parts: string[];
  if (typeof value === 'string') {
    let text = normalizeValue(value);
    // 입력 칸에는 Yale 본체 부분만 들어 있지만, 토큰 앞뒤의 구두점·'-'까지 쳐 넣었으면 떼어 낸다
    // (그대로 두면 출력에서 '그러므로,,'처럼 겹친다)
    const head = info.prefix + info.lead;
    const foot = info.tail + info.suffix;
    if (head && text.startsWith(head)) text = text.slice(head.length);
    if (foot && text.endsWith(foot) && text.length > foot.length) text = text.slice(0, -foot.length);
    if (!isValidValue(text)) return null;
    const split = text.split('-');
    if (split.length !== n || split.some((p) => !p)) {
      if (text === coreText(cur, info)) return null;
      if (text === coreText(base, info)) return revert;
      return { add: [{ scope: 'words', key: info.key, value: text }], remove: [] };
    }
    parts = split;
  } else {
    if (!value.parts || value.parts.length !== n) return null;
    parts = [...value.parts];
  }

  if (sameParts(parts, cur.parts)) return null;
  if (sameParts(parts, base.parts)) return revert;

  const baseParts = base.parts && base.parts.length === n ? base.parts : null;
  if (baseParts) {
    const diff = parts.flatMap((p, i) => (p !== baseParts[i] ? [i] : []));
    const values = new Map<string, string>();
    const byMorpheme = diff.every((i) => {
      const seg = info.segments[i];
      const ok = info.vowel[i]
        && (syllableCount(parts[i]) >= 2 || baseParts[i].toLowerCase() === seg)
        && (values.get(seg) ?? parts[i]) === parts[i]; // 같은 형태소에 다른 값을 주면 어절 항목으로
      values.set(seg, parts[i]);
      return ok;
    });
    // 같은 형태소가 이 토큰의 다른 자리에 원래대로 남아 있으면 형태소 항목이 그 자리까지 바꾸므로 어절 항목으로
    if (byMorpheme && parts.every((p, i) => (values.get(info.segments[i]) ?? p) === p)) {
      const add = [...values].map(([key, v]): DictEntry => ({ scope: 'morphemes', key, value: v }));
      // 이 토큰에서 엔진 결과로 되돌린 형태소 항목, 형태소 항목을 가리는 어절 항목은 지운다
      const remove = hits
        .filter((h) => h.scope === 'words' || !values.has(h.key))
        .map(({ scope, key }) => ({ scope, key }));
      return { add, remove };
    }
  }
  return { add: [{ scope: 'words', key: info.key, value: parts.join('-') }], remove: [] };
}

// 토스트용 요약: "mali → 마리, aphu-n → 아프-ㄴ"
export function summarizeEntries(entries: { key: string; value?: string }[]): string {
  return entries.map((e) => (e.value === undefined ? e.key : `${e.key} → ${e.value}`)).join(', ');
}
