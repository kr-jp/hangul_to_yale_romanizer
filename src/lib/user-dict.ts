// 사용자 사전 — 후보 창에서 고르거나 직접 입력한 변환을 치환 규칙으로 기억해 Yale→한글 변환에 우선 적용한다 (2026-10)
// 형태소 분석은 하지 않는다. 규칙은 Yale 원문의 표기와 글자 그대로 대조한다:
//  - segment(구간 일치): '-'·'.'로 나뉜 부분 하나가 키와 같으면 더 긴 표기 안에서도 그 부분을 값으로
//    (mali → 마리면 Mali-nun, Mali-ka 모두)
//  - whole(전체 일치): 표기 본체(공백·기호·숫자 사이의 Yale 글자와 '-'·'.' 연속에서 앞뒤 '-'·'.'를 뗀 것) 전체가
//    키와 같을 때만 (ki-ka는 'ki-ka.'·'(ki-ka)'에도 적용, 'ki-ka-…'에는 적용 안 함). 값이 구간 수만큼 '-'로 나뉘어 있으면
//    구간별 값(하이픈 표시·종성 결합은 평소대로), 아니면 값 문자열 그대로
// 키는 소문자 Yale. 실제 적용은 엔진(y2h.js rankRun)이 opts.dict로 받아서 한다
import { analyzeToken, parseYaleWordCandidates, yaleRunsIn } from '../converter/y2h.js';
import { convert as hangulToYale } from '../converter/h2y.js';
import {
  CHOSEONG, JUNGSEONG, JONGSEONG, J2Y, NCount, SBase, TCount, composeHangul, isHangulSyllable,
} from '../converter/hangul.js';
import type {
  ConvertOpts, CorrectionPlan, DictChange, DictEntry, DictScope, TokenEditInfo, UserDict, YaleCandidate,
} from './types';

export const EMPTY_DICT: UserDict = { segment: new Map(), whole: new Map() };

// 구간 키는 하이픈 없는 한 부분, 전체 키는 본체 그대로(내부 '-'·'.' 허용)
const KEY_PATTERN: Record<DictScope, RegExp> = {
  segment: /^[a-z]+$/,
  whole: /^[a-z](?:[a-z.-]*[a-z])?$/,
};
export const VALUE_MAX = 60;

export const normalizeKey = (yale: string) => yale.trim().toLowerCase();
export const normalizeValue = (value: string) => value.normalize('NFC').trim();
export const isValidKey = (scope: DictScope, key: string) => KEY_PATTERN[scope].test(key);
// 공백이 들어가면 어절 수가 달라져 인터리니어·글로스 정렬이 깨지므로 받지 않는다
export const isValidValue = (value: string) => value.length > 0 && value.length <= VALUE_MAX && !/\s/.test(value);

export function dictSize(d: UserDict): number {
  return d.segment.size + d.whole.size;
}

// 표시용 목록 — 키 순, 같은 키는 구간 일치가 먼저
export function entriesOf(d: UserDict): DictEntry[] {
  const out: DictEntry[] = [];
  for (const [key, value] of d.segment) out.push({ scope: 'segment', key, value });
  for (const [key, value] of d.whole) out.push({ scope: 'whole', key, value });
  return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.scope === 'segment' ? -1 : 1));
}

// over의 항목이 base보다 우선 (이번 세션 항목 > 저장된 사전)
export function mergeDicts(base: UserDict, over: UserDict): UserDict {
  if (!dictSize(over)) return base;
  if (!dictSize(base)) return over;
  return {
    segment: new Map([...base.segment, ...over.segment]),
    whole: new Map([...base.whole, ...over.whole]),
  };
}

// 바뀐 것이 없으면 같은 객체를 돌려준다 — 사전 객체가 바뀌면 엔진의 run 캐시도 새로 만들어지므로
export function applyChange(d: UserDict, change: Partial<DictChange>): UserDict {
  const remove = (change.remove ?? []).filter((r) => d[r.scope].has(r.key));
  const add = (change.add ?? []).filter((a) => d[a.scope].get(a.key) !== a.value || remove.some((r) => r.scope === a.scope && r.key === a.key));
  if (!remove.length && !add.length) return d;
  const next = { segment: new Map(d.segment), whole: new Map(d.whole) };
  for (const r of remove) next[r.scope].delete(r.key);
  for (const a of add) next[a.scope].set(a.key, a.value);
  return next;
}

export function dictToJSON(d: UserDict): { segment: Record<string, string>; whole: Record<string, string> } {
  return { segment: Object.fromEntries(d.segment), whole: Object.fromEntries(d.whole) };
}

// 외부에서 온 값(저장소·파일·공유 URL) → 유효한 항목만 남긴 사전.
// 2026-10 첫 배포 때의 키 이름(morphemes = 구간 일치, words = 전체 일치)도 읽는다
const JSON_KEYS: [string, DictScope][] = [
  ['morphemes', 'segment'],
  ['words', 'whole'],
  ['segment', 'segment'],
  ['whole', 'whole'],
];
export function dictFromJSON(raw: unknown): UserDict {
  const out = { segment: new Map<string, string>(), whole: new Map<string, string>() };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [field, scope] of JSON_KEYS) {
    const src = (raw as Record<string, unknown>)[field];
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
  const out = { segment: new Map<string, string>(), whole: new Map<string, string>() };
  if (!dictSize(dict)) return out;
  for (const run of yaleRunsIn(text)) {
    const whole = dict.whole.get(run.key);
    if (whole !== undefined) {
      out.whole.set(run.key, whole);
      continue;
    }
    run.segments.forEach((seg: string, i: number) => {
      const value = run.vowel[i] ? dict.segment.get(seg) : undefined;
      if (value !== undefined) out.segment.set(seg, value);
    });
  }
  return out;
}

type TokenInfo = NonNullable<ReturnType<typeof analyzeToken>>;

// 이 토큰에 적용되고 있는 사전 항목 (전체 일치 항목이 있으면 구간 일치 항목은 쓰이지 않는다)
function hitsFor(info: TokenInfo, dict: UserDict | null | undefined): DictEntry[] {
  if (!dict) return [];
  const whole = dict.whole.get(info.key);
  if (whole !== undefined) return [{ scope: 'whole', key: info.key, value: whole }];
  const out: DictEntry[] = [];
  info.segments.forEach((seg: string, i: number) => {
    const value = info.vowel[i] ? dict.segment.get(seg) : undefined;
    if (value !== undefined && !out.some((e) => e.key === seg)) out.push({ scope: 'segment', key: seg, value });
  });
  return out;
}

// 후보의 한글 중 Yale 본체에 해당하는 부분 (토큰 앞뒤 구두점과 run 앞뒤 '-'·'.' 제외)
function coreText(c: YaleCandidate, info: TokenInfo): string {
  const start = info.prefix.length + info.lead.length;
  const end = c.hangul.length - info.suffix.length - info.tail.length;
  return c.hangul.slice(start, Math.max(start, end));
}

// 후보 창에서 후보를 고르면 입력 칸에 넣을 값 — 구간별 출력을 '-'로 이은 형태
export const candidateText = (c: YaleCandidate) => (c.parts ? c.parts.join('-') : c.hangul);

const syllableCount = (s: string) => (s.match(/[가-힣]/g) || []).length;
const sameParts = (a: readonly string[], b: readonly string[] | null | undefined) =>
  !!b && a.length === b.length && a.every((x, i) => x === b[i]);

// 하이픈 없이 입력한 한글을 토큰의 구간에 맞춰 나눈다. 입력을 Yale로 바꾼 것이 토큰의 Yale과 같을 때만
// (표준 Yale이면 aphu-n에 '아픈'을 넣어도 아프 | ㄴ). 음절 안에서는 받침 바로 앞에서만 나눈다
function alignToSegments(text: string, info: TokenInfo, labial: boolean): string[] | null {
  const bounds: number[] = [];
  let acc = 0;
  for (const seg of info.segments.slice(0, -1)) bounds.push((acc += seg.length));
  const units: { ch: string; yale: string; open?: string; openYale?: string; coda?: string }[] = [];
  for (const ch of text) {
    if (isHangulSyllable(ch)) {
      const idx = ch.codePointAt(0)! - SBase;
      const t = idx % TCount;
      const unit: (typeof units)[number] = { ch, yale: hangulToYale(ch, { labial }) };
      if (t) {
        unit.open = composeHangul(CHOSEONG[Math.floor(idx / NCount)], JUNGSEONG[Math.floor((idx % NCount) / TCount)], null);
        unit.openYale = hangulToYale(unit.open!, { labial });
        unit.coda = JONGSEONG[t];
      }
      units.push(unit);
    } else if (Object.prototype.hasOwnProperty.call(J2Y, ch)) {
      units.push({ ch, yale: (J2Y as Record<string, string>)[ch] }); // 자모로 쓴 형태소 (ㄴ 등)
    } else if (/[a-zA-Z]/.test(ch)) {
      units.push({ ch, yale: ch.toLowerCase() }); // 원문 그대로 둔 로마자 (John 등)
    } else {
      return null;
    }
  }
  if (units.map((u) => u.yale).join('') !== info.segments.join('')) return null;
  const parts = [''];
  let pos = 0;
  let b = 0;
  for (const u of units) {
    while (b < bounds.length && bounds[b] === pos) {
      parts.push('');
      b++;
    }
    const end = pos + u.yale.length;
    if (b < bounds.length && bounds[b] < end) {
      if (!u.open || pos + u.openYale!.length !== bounds[b]) return null;
      parts[parts.length - 1] += u.open;
      parts.push(u.coda!);
      if (++b < bounds.length && bounds[b] < end) return null;
    } else {
      parts[parts.length - 1] += u.ch;
    }
    pos = end;
  }
  return b === bounds.length && parts.every(Boolean) ? parts : null;
}

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
  };
}

// 고친 결과(입력 칸의 한글) → 만들 수 있는 사전 변경과 기본 범위. 저장 전에 규칙을 보여 주고 고르게 하기 위함.
// - 구간별 값: '-'로 나눈 수가 토큰의 구간 수와 같으면 그대로, 하이픈 없이 입력했으면 Yale로 맞춰 나눈다
// - 구간 일치: 바뀐 부분마다 규칙 하나. 자음만의 부분을 바꿨거나 같은 부분에 다른 값을 주면 고를 수 없다
// - 전체 일치: 언제나 고를 수 있다 (구간에 맞추지 못한 입력은 그 문자열 그대로)
// - 기본값: 바뀐 부분이 모두 2음절 이상이거나 원래 변환되지 않던 부분(John 등)이면 구간 일치.
//   1음절 부분은 표준 Yale의 다른 표기와 겹치기 쉬워 전체 일치 (khi(키)를 ki로 쓰는 문헌의 ki → 키를
//   구간 일치로 기억하면 표준 Yale의 ki(기)까지 바뀐다)
// - 엔진 결과(사전 없이)로 되돌린 것이면 이 토큰에 쓰인 항목을 지운다
export function planCorrection(token: string, value: string, opts: ConvertOpts): CorrectionPlan | null {
  const info = analyzeToken(token);
  if (!info) return null;
  const n = info.segments.length;
  const cur = parseYaleWordCandidates(token, opts, 1)[0];
  const base = parseYaleWordCandidates(token, { ...opts, dict: null }, 1)[0];
  if (!cur || !base) return null;
  const hits = hitsFor(info, opts.dict);
  const plan = (kind: CorrectionPlan['kind'], extra: Partial<CorrectionPlan> = {}): CorrectionPlan => ({
    kind,
    revert: null,
    segment: null,
    whole: null,
    defaultScope: 'whole',
    segmentBlocked: null,
    shortSegment: false,
    ...extra,
  });

  let text = normalizeValue(value);
  // 입력 칸에는 Yale 본체 부분만 들어 있지만, 토큰 앞뒤의 구두점·'-'까지 쳐 넣었으면 떼어 낸다
  // (그대로 두면 출력에서 '그러므로,,'처럼 겹친다)
  const head = info.prefix + info.lead;
  const foot = info.tail + info.suffix;
  if (head && text.startsWith(head)) text = text.slice(head.length);
  if (foot && text.endsWith(foot) && text.length > foot.length) text = text.slice(0, -foot.length);
  if (!isValidValue(text)) return null;

  const split = text.split('-');
  const parts =
    split.length === n && split.every(Boolean)
      ? split
      : text.includes('-')
        ? null
        : alignToSegments(text, info, opts.labial);

  if (parts ? sameParts(parts, cur.parts) : text === coreText(cur, info)) return plan('none');
  if (parts ? sameParts(parts, base.parts) : text === coreText(base, info)) {
    return hits.length
      ? plan('revert', { revert: { add: [], remove: hits.map(({ scope, key }) => ({ scope, key })) } })
      : plan('none');
  }

  const whole: DictChange = { add: [{ scope: 'whole', key: info.key, value: parts ? parts.join('-') : text }], remove: [] };
  const baseParts = base.parts && base.parts.length === n ? base.parts : null;
  if (!parts || !baseParts) return plan('rule', { whole, segmentBlocked: 'unaligned' });

  const diff = parts.flatMap((p, i) => (p !== baseParts[i] ? [i] : []));
  const values = new Map<string, string>();
  const consistent = diff.every((i) => {
    const seg = info.segments[i];
    const ok = info.vowel[i] && (values.get(seg) ?? parts[i]) === parts[i];
    values.set(seg, parts[i]);
    return ok;
  });
  // 같은 부분이 이 토큰의 다른 자리에 원래대로 남아 있으면 구간 일치 규칙이 그 자리까지 바꾸므로 고를 수 없다
  if (!consistent || !parts.every((p, i) => (values.get(info.segments[i]) ?? p) === p)) {
    return plan('rule', { whole, segmentBlocked: 'mixed' });
  }
  const segment: DictChange = {
    add: [...values].map(([key, v]): DictEntry => ({ scope: 'segment', key, value: v })),
    // 이 토큰에서 엔진 결과로 되돌린 구간 일치 항목, 구간 일치 항목을 가리는 전체 일치 항목은 지운다
    remove: hits.filter((h) => h.scope === 'whole' || !values.has(h.key)).map(({ scope, key }) => ({ scope, key })),
  };
  const long = diff.every((i) => syllableCount(parts[i]) >= 2 || baseParts[i].toLowerCase() === info.segments[i]);
  return plan('rule', { segment, whole, defaultScope: long ? 'segment' : 'whole', shortSegment: !long });
}

// 기본 범위로 바로 고칠 때의 사전 변경 (바뀐 것이 없으면 null)
export function learnCorrection(token: string, value: string, opts: ConvertOpts): DictChange | null {
  const p = planCorrection(token, value, opts);
  if (!p || p.kind === 'none') return null;
  if (p.kind === 'revert') return p.revert;
  return (p.defaultScope === 'segment' ? p.segment : p.whole) ?? p.whole;
}

// 토스트·미리보기용 요약: "mali → 마리, aphu-n → 아프-ㄴ"
export function summarizeEntries(entries: { key: string; value?: string }[]): string {
  return entries.map((e) => (e.value === undefined ? e.key : `${e.key} → ${e.value}`)).join(', ');
}
