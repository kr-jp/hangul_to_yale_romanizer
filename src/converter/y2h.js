// Yale 로마자 → 한글 역변환
// 그래프 기반 음절 분할 + 빔서치 DP. 빈도 데이터가 없으면 탐욕 파서로 폴백
import mappings from '../data/mappings.json' with { type: 'json' };
import {
  CHOSEONG, JUNGSEONG, JONGSEONG,
  SBase, NCount, TCount,
  J2Y, BILABIALS, DOUBLE_CODA_SPLIT,
  isHangulSyllable, composeHangul,
} from './hangul.js';

// Yale → 자모 역매핑
const Y2J = {};
for (const [jamo, yale] of Object.entries(J2Y)) Y2J[yale] = jamo;

// 두 자모 → 겹받침 자모 결합 (DOUBLE_CODA_SPLIT 역방향)
const DOUBLE_CODA_JOIN = {};
for (const [compound, parts] of Object.entries(DOUBLE_CODA_SPLIT)) {
  DOUBLE_CODA_JOIN[parts] = compound;
}

const YALE_CONSONANTS = new Set(mappings.yaleConsonants);
const YALE_VOWELS = new Set(mappings.yaleVowels);
const YALE_CODAS = new Set(mappings.yaleCodas);
const YALE_ONSETS = new Set(mappings.yaleOnsets);
const Y2J_CODA = mappings.yaleToJamoCoda;
const YALE_DOUBLE_CODA = mappings.yaleDoubleCoda;

// 빈도 데이터(외부 주입). 없으면 탐욕 파서가 사용됨
let syllableFreq = null;
let bigramFreq = null;
let wordFreq = null;

// run 단위 후보 캐시 — 같은 어절의 반복·타이핑 중 재계산을 피한다 (대량 입력 성능).
// 결과가 빈도 데이터·옵션에 따라 달라지므로 키에 옵션을 넣고, 데이터 주입 시 비운다.
// 사용자 사전(opts.dict)이 있으면 사전 객체마다 별도 캐시 — 사전을 고치면 새 객체가 되어 자연히 새 캐시
const runCache = new Map();
let dictCaches = new WeakMap();
const RUN_CACHE_MAX = 50000;

function cacheFor(dict) {
  if (!dict) return runCache;
  let cache = dictCaches.get(dict);
  if (!cache) {
    cache = new Map();
    dictCaches.set(dict, cache);
  }
  return cache;
}

// UI 레이어가 fetch 후 호출. {syllable, bigram, word} 형태로 주입
export function setFrequencyData({ syllable = null, bigram = null, word = null } = {}) {
  syllableFreq = syllable;
  bigramFreq = bigram;
  wordFreq = word;
  runCache.clear();
  dictCaches = new WeakMap();
}

// 빔서치/단어 보너스 가중치
const PENALTY_UNI = -8.0;
const W_BI = 0.7;
const BI_MISS_BASE = -13.0;
const BEAM_K = 5;
const W_WORD_2 = 1.5;
const W_WORD_3 = 3.5;

// 최장 일치로 토큰 추출
function matchYaleToken(str, pos, tokenSet) {
  for (let len = 3; len >= 1; len--) {
    const sub = str.slice(pos, pos + len);
    if (tokenSet.has(sub)) return sub;
  }
  return null;
}

// 지정 위치의 가능한 모든 토큰(최장→최단)
function allTokensAt(str, pos, tokenSet) {
  const results = [];
  for (let len = 3; len >= 1; len--) {
    if (pos + len > str.length) continue;
    const sub = str.slice(pos, pos + len);
    if (tokenSet.has(sub)) results.push(sub);
  }
  return results;
}

// Yale run: Yale 로마자와 경계 기호(. -)의 연속. 그 밖의 문자(공백·숫자·괄호 등)는 변환하지 않고 보존
const YALE_RUN = /[a-zA-Z.\-]+/g;

// Yale에 쓰이지 않는 로마자(b d f j q r v x z, ng 밖의 g)가 든 구간은 영어 이름 등 다른 표기로 보고
// 원문 그대로 둔다 (John-un → John-은). 대문자로만 된 2글자 이상(IP, NOM 등 약어·범주 기호)도 같다
const NON_YALE = /[bdfjqrvxz]|(?<!n)g/;
const ALL_CAPS = /^[A-Z]{2,}$/;
function isForeignSegment(raw) {
  return NON_YALE.test(raw.toLowerCase()) || ALL_CAPS.test(raw);
}

// run → 선두 기호(lead) + 본체(core) + 말미 기호(tail)
function splitRun(run) {
  const lead = run.match(/^[.\-]+/)?.[0] ?? '';
  const rest = run.slice(lead.length);
  const tail = rest.match(/[.\-]+$/)?.[0] ?? '';
  return { lead, core: rest.slice(0, rest.length - tail.length), tail };
}

// run의 본체 구성 — key = 사전 키(소문자 본체), segments = '.'/'-'로 나뉜 구간(소문자),
// vowel = 구간에 모음 글자가 있는지 (없으면 자음만의 형태소). 본체가 없으면 null
function runInfo(run) {
  const { lead, core, tail } = splitRun(run);
  if (!core) return null;
  const segments = core.split(/[.\-]+/).map((s) => s.toLowerCase());
  return { lead, tail, key: core.toLowerCase(), segments, vowel: segments.map((s) => /[aeiou]/.test(s)) };
}

// 후보 창(사용자 사전 학습)용 토큰 구성. Yale run이 정확히 1개이고 본체가 있을 때만, 아니면 null.
// prefix/suffix = run 앞뒤의 비-Yale 문자(구두점 등), lead/tail = run 앞뒤의 '.'/'-'
export function analyzeToken(word) {
  if (!word) return null;
  const runs = [...word.matchAll(YALE_RUN)];
  if (runs.length !== 1) return null;
  const info = runInfo(runs[0][0]);
  if (!info) return null;
  const m = runs[0];
  return { ...info, prefix: word.slice(0, m.index), suffix: word.slice(m.index + m[0].length) };
}

// 텍스트 안의 모든 Yale run 구성 (사용자 사전 항목이 실제로 쓰이는지 판정용)
export function yaleRunsIn(text) {
  const out = [];
  for (const m of (text || '').matchAll(YALE_RUN)) {
    const info = runInfo(m[0]);
    if (info) out.push(info);
  }
  return out;
}

// Yale → 한글 메인 진입점. 줄/공백/구두점은 그대로 보존.
// opts: { labial = true, keepHyphens = false, dict = null } — keepHyphens면 어절 내부 '-'(형태소 경계)를
// 출력에 남긴다. dict는 사용자 사전 { words: Map, morphemes: Map } (src/lib/user-dict.ts)
export function reverseConvert(text, opts = {}) {
  if (!text || !text.trim()) return '';
  return text.replace(YALE_RUN, (run, offset) =>
    parseYaleWord(run, opts, { before: text[offset - 1], after: text[offset + run.length] }));
}

// Yale run 1개 → 최선의 한글 1개 (rankRun의 1위). ctx = run 바로 앞뒤 문자 (괄호 인접 판정용)
export function parseYaleWord(word, opts = {}, ctx = {}) {
  return rankRun(word, opts, ctx)[0]?.hangul ?? '';
}

// 한 토큰(공백 단위)의 top-K 한글 후보. 모호성 없는 단어는 후보 1개, 빈도 데이터가 없으면 best 1개만.
// 토큰에 비-Yale 문자(?, ,, ! 등)가 섞여 있으면 Yale run만 변환하고 앞뒤 문자는 보존.
// '.'·'-'가 든 어절도 후보를 낸다 — 경계는 음절 분할을 고정할 뿐, 각 구간 안은 여전히 확률 변환이므로
export function parseYaleWordCandidates(word, opts = {}, k = 5) {
  if (!word) return [];
  const runs = [...word.matchAll(YALE_RUN)];
  // Yale run이 없는 토큰(숫자·기호 등)은 원형 그대로 후보 1개 — 토큰 소실 방지 (2026-06-12)
  if (!runs.length) return [{ hangul: word, score: 0 }];
  // run이 2개 이상(내부 구두점 혼합, 예: 'ka,na', '-(u)n')이면 각 run을 결정론 변환해 제자리 치환.
  // 후보 분기는 단일 run일 때만 — 혼합 토큰은 best 1개로 변환 누락만 방지 (2026-06-12)
  if (runs.length > 1) return [{ hangul: reverseConvert(word, opts), score: 0 }];
  const m = runs[0];
  const prefix = word.slice(0, m.index);
  const suffix = word.slice(m.index + m[0].length);
  const all = rankRun(m[0], opts, { before: prefix.slice(-1), after: suffix.charAt(0) });
  const candidates = syllableFreq && bigramFreq ? all.slice(0, k) : all.slice(0, 1);
  if (!prefix && !suffix) return candidates;
  return candidates.map((c) => ({ ...c, hangul: prefix + c.hangul + suffix }));
}

// Yale run 1개 → 점수 내림차순 한글 후보 (최소 1개, 최대 BEAM_K개).
// - 선두·말미의 '.'/'-' run은 그대로 보존: 문장부호(hankwuk.)와 인용형 하이픈(-ko → -고, mek- → 먹-)
// - 내부의 '.'/'-'는 음절 경계를 고정하는 위치. 출력에서 '.'은 지우고, '-'는 keepHyphens일 때만 남긴다.
//   단 '..' 이상(말줄임표)이나 변환되지 않은 구간(CD-ROM의 CD 등) 옆의 기호는 원문 그대로 둔다
// - 구간별 후보를 빔으로 결합(점수 = 구간 점수의 합)하므로 하이픈이 든 어절도 후보를 고를 수 있다.
//   1위는 구간별 최선의 연결과 같다 — 경계 바이그램을 더해도 정확도가 오르지 않아 넣지 않음 (실측)
// - 자음만의 구간은 앞 음절의 종성으로 결합(ka-ss-ta → 갔다). 결합할 수 없거나 keepHyphens에서 '-' 뒤에
//   오면, 형태소 표기 맥락(하이픈·괄호 인접, 하이픈 없는 숫자 인접 제외)의 소문자에 한해 자모로 쓴다
//   (-(u)n → -(으)ㄴ, ka-ss-ta → 가-ㅆ-다, ku]-n1 → 그]-ㄴ1). 그 밖에는 원문 그대로(NP, pp., 214m)
// - Yale에 없는 글자가 든 구간(John)·대문자 약어(IP)는 원문 그대로. 숫자가 바로 붙은 단독 e는
//   공범주 표기(e1)로 보고 그대로 둔다
// - opts.dict(사용자 사전)가 있으면 사전 항목이 엔진 결과보다 우선 (사전 형식은 user-dict.ts)
// 후보: { hangul, score, parts, dict } — parts는 구간별 출력(자음 구간은 자모·원문), 사전 문자열을 그대로
//   쓴 경우 null. dict는 사전 항목이 쓰였는지
// ctx.before/after: run 바로 앞뒤의 문자 (run은 최장 일치이므로 로마자·'.'·'-'는 오지 않는다)
function rankRun(run, { labial = true, keepHyphens = false, dict = null } = {}, ctx = {}) {
  const pb = /[()]/.test(ctx.before || '');
  const pa = /[()]/.test(ctx.after || '');
  const db = /\d/.test(ctx.before || '');
  const da = /\d/.test(ctx.after || '');
  const cache = cacheFor(dict);
  const key = [labial, keepHyphens, pb, pa, db, da].map(Number).join('') + '|' + run;
  const cached = cache.get(key);
  if (cached) return cached;

  const { lead, core, tail } = splitRun(run);
  let result = [{ hangul: run, score: 0 }]; // 기호만으로 된 run('-', '...')과 공범주 e는 그대로
  if (core) {
    const pieces = core.split(/([.\-]+)/); // 짝수 인덱스 = 구간, 홀수 인덱스 = 경계 기호
    const lastIdx = pieces.length - 1;
    // 사전의 어절 항목: '-'로 나눈 값이 구간 수와 맞으면 구간별 강제값, 아니면 값 문자열 그대로
    const wordValue = dict?.words?.get(core.toLowerCase());
    const forced = wordValue === undefined ? null : wordValue.split('-');
    if (forced && forced.length !== lastIdx / 2 + 1) {
      result = [{ hangul: lead + wordValue + tail, score: 0, parts: null, dict: true }];
    } else if (!forced && !lead && !tail && da && core === 'e') {
      // 공범주 e₁ — PDF에서 복사하면 아래첨자가 일반 숫자가 된다 (어1이 되지 않게)
    } else {
      // raw: 직전 구간이 변환되지 않고 원문 그대로 남았는지 (경계 기호 출력 판정용)
      let beam = [{ hangul: '', score: 0, raw: false, parts: [], dict: false }];
      for (let i = 0; i <= lastIdx; i += 2) {
        const raw = pieces[i];
        const seg = raw.toLowerCase();
        const sep = i > 0 ? pieces[i - 1] : '';
        const ellipsis = sep.includes('..');
        const sepOut = (prevRaw, curRaw) =>
          ellipsis || prevRaw || curRaw ? sep : keepHyphens ? sep.replace(/\./g, '') : '';
        if (/[aeiou]/.test(seg)) {
          let forcedPart = forced ? forced[i / 2] : dict?.morphemes?.get(seg);
          const foreign = forcedPart === undefined && isForeignSegment(raw);
          // 받침 자음으로 시작하는 어미 표기(sa-nta → 사-ㄴ다·산다, ka-lkka → 가-ㄹ까·갈까): 그 자음은
          // 자음만의 구간과 같은 규칙(앞 음절 받침에 결합, keepHyphens에서 '-' 뒤면 자모)으로, 나머지만 음절 변환
          let pre = foreign ? null : leadingCoda(seg);
          if (pre && forcedPart !== undefined) {
            // 사전 값도 그 자모로 시작할 때만 나눈다 (ㄴ다 → ㄴ + 다). 아니면 값 그대로
            const j = consonantJamo(pre);
            if (forcedPart.startsWith(j)) forcedPart = forcedPart.slice(j.length);
            else pre = null;
          }
          const body = pre ? seg.slice(pre.length) : seg;
          const cands =
            forcedPart !== undefined
              ? [{ hangul: forcedPart, score: 0, dict: true }]
              : foreign
                ? [{ hangul: raw, score: 0 }]
                : segmentCandidates(body, labial);
          const hyphenBefore = sep.includes('-');
          const preRaw = pre ? raw.slice(0, pre.length) : '';
          const preJamo = pre && preRaw === pre && !(i === 0 && db)
            && (hyphenBefore || (i === 0 && (lead.includes('-') || pb)))
            ? consonantJamo(pre)
            : null;
          const next = [];
          for (const b of beam) {
            // 앞 받침 자음까지 붙인 머리 (pre가 없으면 구간 사이 기호는 후보별로 정한다)
            let head = null;
            if (pre) {
              const attached = (keepHyphens && hyphenBefore) || ellipsis ? null : attachCoda(b.hangul, pre);
              head = attached ?? b.hangul + sepOut(b.raw, !preJamo) + (preJamo || preRaw);
            }
            for (const c of cands) {
              const curRaw = !c.dict && c.hangul.toLowerCase() === body;
              next.push({
                hangul: (head ?? b.hangul + sepOut(b.raw, curRaw)) + c.hangul,
                score: b.score + c.score,
                raw: curRaw,
                parts: [...b.parts, (pre ? preJamo || preRaw : '') + c.hangul],
                dict: b.dict || !!c.dict,
              });
            }
          }
          beam = topCandidates(next);
        } else {
          const hyphenBefore = sep.includes('-');
          const hyphenCtx = hyphenBefore || (i === 0 && lead.includes('-'));
          // 숫자에 붙은 자음은 단위·기호(214m)로 본다. 단 하이픈 뒤의 형태소에 붙은 숫자는 지표(-n1)
          const edgeDigit = (i === 0 && db) || (i === lastIdx && da && !hyphenCtx);
          const morph = !edgeDigit && (hyphenBefore || (pieces[i + 1] || '').includes('-')
            || (i === 0 && (lead.includes('-') || pb))
            || (i === lastIdx && (tail.includes('-') || pa)));
          const jamo = morph && raw === seg ? consonantJamo(seg) : null;
          const natural = jamo || raw;
          // 사전 값이 이 자음의 자모·원문과 다르면 그 문자열을 그대로 쓴다
          const forcedPart = forced ? forced[i / 2] : undefined;
          const literal = forcedPart !== undefined && forcedPart !== natural && forcedPart !== consonantJamo(seg)
            ? forcedPart
            : null;
          beam = topCandidates(beam.map((b) => {
            const parts = [...b.parts, literal ?? natural];
            if (literal !== null) {
              return { ...b, hangul: b.hangul + sepOut(b.raw, false) + literal, raw: false, parts, dict: true };
            }
            const attached = (keepHyphens && hyphenBefore) || ellipsis ? null : attachCoda(b.hangul, seg);
            if (attached) return { ...b, hangul: attached, raw: false, parts };
            return { ...b, hangul: b.hangul + sepOut(b.raw, !jamo) + natural, raw: !jamo, parts };
          }));
        }
      }
      result = beam.map((b) => ({ hangul: lead + b.hangul + tail, score: b.score, parts: b.parts, dict: b.dict || !!forced }));
    }
  }
  result.forEach(Object.freeze);
  if (cache.size >= RUN_CACHE_MAX) cache.clear();
  cache.set(key, result);
  return result;
}

// 모음을 포함한 구간의 후보 (빈도 데이터가 있으면 빔서치 top-K, 없으면 탐욕 파서 1개)
function segmentCandidates(seg, labial) {
  if (syllableFreq && bigramFreq) return disambiguateSegment(seg, labial, true);
  return [{ hangul: parseYaleWordGreedy(seg, { labial }), score: 0 }];
}

// 점수 내림차순(안정 정렬) + 같은 문자열 중복 제거 + 상위 BEAM_K
function topCandidates(list) {
  const seen = new Set();
  const out = [];
  for (const c of [...list].sort((a, b) => b.score - a.score)) {
    if (seen.has(c.hangul)) continue;
    seen.add(c.hangul);
    out.push(c);
    if (out.length >= BEAM_K) break;
  }
  return out;
}

// str 끝 음절의 종성으로 자음 구간을 결합 (가 + ss → 갔, 갈 + k → 갉). 불가하면 null
function attachCoda(str, seg) {
  const lastChar = str.slice(-1);
  if (!isHangulSyllable(lastChar)) return null;
  const codaJamo = YALE_DOUBLE_CODA[seg] || Y2J_CODA[seg];
  if (!codaJamo) return null;
  const SIndex = lastChar.codePointAt(0) - SBase;
  const TIndex = SIndex % TCount;
  const newCoda = TIndex === 0 ? codaJamo : DOUBLE_CODA_JOIN[JONGSEONG[TIndex] + codaJamo];
  if (!newCoda) return null;
  const onset = CHOSEONG[Math.floor(SIndex / NCount)];
  const vowel = JUNGSEONG[Math.floor((SIndex % NCount) / TCount)];
  const newChar = composeHangul(onset, vowel, newCoda);
  return newChar ? str.slice(0, -1) + newChar : null;
}

// Yale 음절(자음 1개 + 모음, 또는 모음)로 시작하는가
function startsSyllable(s) {
  if (matchYaleToken(s, 0, YALE_VOWELS)) return true;
  const onset = matchYaleToken(s, 0, YALE_ONSETS);
  return !!onset && !!matchYaleToken(s, onset.length, YALE_VOWELS);
}

// 구간이 받침 자음으로 시작하면(nta, lkka, pnita) 나머지가 음절로 시작하게 되는 가장 짧은 받침, 아니면 null
function leadingCoda(seg) {
  if (startsSyllable(seg)) return null;
  for (let len = 1; len < seg.length; len++) {
    const pre = seg.slice(0, len);
    if ((YALE_DOUBLE_CODA[pre] || Y2J_CODA[pre]) && startsSyllable(seg.slice(len))) return pre;
  }
  return null;
}

// 자음만의 구간 → 호환 자모 (n → ㄴ, ss → ㅆ, lk → ㄺ, pp → ㅃ). Yale 자음이 아니면 null
const ONSET_ONLY_JAMO = { pp: 'ㅃ', tt: 'ㄸ', cc: 'ㅉ' };
function consonantJamo(seg) {
  return YALE_DOUBLE_CODA[seg] || Y2J_CODA[seg] || ONSET_ONLY_JAMO[seg] || null;
}

// ===== 스마트 파서: 그래프 + 빔서치 DP =====
// returnAll=true면 dp[n]의 top-K 후보를 모두 backtrack해 [{hangul, score}, ...] 반환
function disambiguateSegment(seg, labial, returnAll = false) {
  const n = seg.length;
  if (n === 0) return returnAll ? [] : '';

  const edges = Array.from({ length: n }, () => []);

  for (let i = 0; i < n; i++) {
    if (!/[a-z]/.test(seg[i])) continue;

    // A) 모음 단독 시작 (ㅇ 자동 삽입)
    const vowelsAtI = allTokensAt(seg, i, YALE_VOWELS);
    for (const v of vowelsAtI) {
      const vJamo = Y2J[v];
      const afterV = i + v.length;
      const h0 = composeHangul('ㅇ', vJamo, null);
      if (h0) edges[i].push({ end: afterV, hangul: h0 });
      addCodaEdgesGraph(seg, afterV, 'ㅇ', vJamo, edges[i]);
      addDoubleCodaEdgesGraph(seg, afterV, 'ㅇ', vJamo, edges[i]);
    }

    // B) 초성 자음 + 모음
    const onsetsAtI = allTokensAt(seg, i, YALE_ONSETS);
    for (const c of onsetsAtI) {
      const cJamo = Y2J[c] || 'ㅇ';
      const afterC = i + c.length;
      const vowelsAfterC = allTokensAt(seg, afterC, YALE_VOWELS);
      for (const v of vowelsAfterC) {
        const vJamo = Y2J[v];
        const afterV = afterC + v.length;

        // 양순음+u: 기본 해석 ㅜ, 대안 ㅡ에 패널티
        const isLabialU = labial && v === 'u' && BILABIALS.has(cJamo);
        if (isLabialU) {
          const vWu = 'ㅜ';
          const hWu0 = composeHangul(cJamo, vWu, null);
          if (hWu0) edges[i].push({ end: afterV, hangul: hWu0 });
          addCodaEdgesGraph(seg, afterV, cJamo, vWu, edges[i]);
          addDoubleCodaEdgesGraph(seg, afterV, cJamo, vWu, edges[i]);
        }

        const labialAltPenalty = isLabialU ? -1.5 : 0;
        const h0 = composeHangul(cJamo, vJamo, null);
        if (h0) edges[i].push({ end: afterV, hangul: h0, bonus: labialAltPenalty });
        addCodaEdgesGraph(seg, afterV, cJamo, vJamo, edges[i], labialAltPenalty);
        addDoubleCodaEdgesGraph(seg, afterV, cJamo, vJamo, edges[i], labialAltPenalty);
      }
    }
  }

  // dp[i] = [{score, prevPos, prevIdx, hangul, lastSyl, prevSyl}, ...]
  const dp = Array.from({ length: n + 1 }, () => []);
  dp[0].push({ score: 0, prevPos: -1, prevIdx: -1, hangul: '', lastSyl: '', prevSyl: '' });

  for (let i = 0; i <= n; i++) {
    if (dp[i].length > BEAM_K) {
      dp[i].sort((a, b) => b.score - a.score);
      dp[i].length = BEAM_K;
    }
    if (i >= n || !edges[i] || !edges[i].length) continue;

    for (let ci = 0; ci < dp[i].length; ci++) {
      const cand = dp[i][ci];
      for (const edge of edges[i]) {
        const uniScore = syllableFreq[edge.hangul] ?? PENALTY_UNI;
        let biScore = 0;
        if (cand.lastSyl) {
          const bigram = cand.lastSyl + edge.hangul;
          const bFreq = bigramFreq[bigram];
          biScore = (bFreq !== undefined) ? (W_BI * bFreq) : (W_BI * BI_MISS_BASE);
        }
        let wordBonus = 0;
        if (wordFreq) {
          if (cand.lastSyl && wordFreq[cand.lastSyl + edge.hangul] !== undefined) {
            wordBonus = W_WORD_2;
          }
          if (cand.prevSyl && cand.lastSyl) {
            const w3 = cand.prevSyl + cand.lastSyl + edge.hangul;
            if (wordFreq[w3] !== undefined) wordBonus = Math.max(wordBonus, W_WORD_3);
          }
        }
        const total = cand.score + uniScore + biScore + (edge.bonus || 0) + wordBonus;
        dp[edge.end].push({
          score: total,
          prevPos: i,
          prevIdx: ci,
          hangul: edge.hangul,
          lastSyl: edge.hangul,
          prevSyl: cand.lastSyl,
        });
      }
    }
  }

  if (!dp[n].length) {
    const fallback = parseYaleWordGreedy(seg, { labial });
    return returnAll ? (fallback ? [{ hangul: fallback, score: 0 }] : []) : fallback;
  }

  // dp[n]을 점수 내림차순 인덱스로 정렬
  const sortedIdx = dp[n].map((_, i) => i)
    .sort((a, b) => dp[n][b].score - dp[n][a].score);

  if (!returnAll) {
    return backtrackFrom(dp, n, sortedIdx[0]);
  }

  // top-K 후보를 모두 backtrack, 동일 결과는 한 번만
  const seen = new Set();
  const candidates = [];
  for (const idx of sortedIdx) {
    const hangul = backtrackFrom(dp, n, idx);
    if (!seen.has(hangul)) {
      seen.add(hangul);
      candidates.push({ hangul, score: dp[n][idx].score });
    }
  }
  return candidates;
}

function backtrackFrom(dp, n, startIdx) {
  const result = [];
  let pos = n, idx = startIdx;
  while (pos > 0 && dp[pos][idx]) {
    result.unshift(dp[pos][idx].hangul);
    const c = dp[pos][idx];
    pos = c.prevPos;
    idx = c.prevIdx;
  }
  return result.join('');
}

function addCodaEdgesGraph(word, afterV, onset, vowel, edgeList, bonus = 0) {
  const codas = allTokensAt(word, afterV, YALE_CODAS);
  for (const cd of codas) {
    const cdJamo = Y2J_CODA[cd];
    if (!cdJamo) continue;
    const afterCd = afterV + cd.length;
    const h = composeHangul(onset, vowel, cdJamo);
    if (h) edgeList.push({ end: afterCd, hangul: h, bonus });
  }
}

function addDoubleCodaEdgesGraph(word, afterV, onset, vowel, edgeList, bonus = 0) {
  for (const [dcYale, dcJamo] of Object.entries(YALE_DOUBLE_CODA)) {
    if (afterV + dcYale.length > word.length) continue;
    if (word.slice(afterV, afterV + dcYale.length) === dcYale) {
      const afterDC = afterV + dcYale.length;
      const h = composeHangul(onset, vowel, dcJamo);
      if (h) edgeList.push({ end: afterDC, hangul: h, bonus });
    }
  }
}

// ===== 탐욕 파서 (폴백) =====
export function parseYaleWordGreedy(word, { labial = true } = {}) {
  const syllables = [];
  let pos = 0;

  while (pos < word.length) {
    if (word[pos] === '.' || word[pos] === '-') { pos++; continue; }

    if (!/[a-z]/.test(word[pos])) {
      syllables.push(word[pos]);
      pos++;
      continue;
    }

    const start = pos; // 합성 실패 시 이 음절에서 소비한 문자를 그대로 되돌리기 위함
    let onset = 'ㅇ';
    let vowel = null;
    let coda = null;

    const consonant = matchYaleToken(word, pos, YALE_CONSONANTS);
    if (consonant) {
      const afterC = pos + consonant.length;
      const nextVowel = matchYaleToken(word, afterC, YALE_VOWELS);
      if (nextVowel) {
        onset = Y2J[consonant] || 'ㅇ';
        pos = afterC;
      } else {
        const directVowel = matchYaleToken(word, pos, YALE_VOWELS);
        if (directVowel) {
          onset = 'ㅇ';
        } else {
          syllables.push(word[pos]);
          pos++;
          continue;
        }
      }
    }

    vowel = matchYaleToken(word, pos, YALE_VOWELS);
    if (!vowel) {
      syllables.push(word[pos]);
      pos++;
      continue;
    }
    const vowelJamo = Y2J[vowel];
    pos += vowel.length;

    let finalVowel = vowelJamo;
    if (labial && vowel === 'u' && BILABIALS.has(onset)) {
      finalVowel = 'ㅜ';
    }

    coda = null;

    // 겹받침 우선 시도
    for (let dcLen = 3; dcLen >= 2; dcLen--) {
      const dcCandidate = word.slice(pos, pos + dcLen);
      if (YALE_DOUBLE_CODA[dcCandidate]) {
        const afterDC = pos + dcLen;
        const nextAfterDC = matchYaleToken(word, afterDC, YALE_VOWELS);
        if (!nextAfterDC && (afterDC >= word.length || word[afterDC] === '.' || !/[a-z]/.test(word[afterDC]) || matchYaleToken(word, afterDC, YALE_CONSONANTS))) {
          coda = YALE_DOUBLE_CODA[dcCandidate];
          pos += dcLen;
          break;
        }
      }
    }

    // 단일 종성
    if (!coda) {
      const codaCandidate = matchYaleToken(word, pos, YALE_CODAS);
      if (codaCandidate) {
        const afterCoda = pos + codaCandidate.length;

        const nextVowelAfterCoda = matchYaleToken(word, afterCoda, YALE_VOWELS);
        if (nextVowelAfterCoda) {
          // 동일 문자 반복(kk, ss)만 분할
          const isSameCharDoubled = codaCandidate.length === 2 && codaCandidate[0] === codaCandidate[1];
          if (isSameCharDoubled) {
            const shorter = codaCandidate[0];
            if (YALE_CODAS.has(shorter) && Y2J_CODA[shorter]) {
              const afterShorter = pos + 1;
              const remainderConsonant = matchYaleToken(word, afterShorter, YALE_CONSONANTS);
              if (remainderConsonant) {
                const afterRemainder = afterShorter + remainderConsonant.length;
                const vowelAfterRemainder = matchYaleToken(word, afterRemainder, YALE_VOWELS);
                if (vowelAfterRemainder) {
                  coda = Y2J_CODA[shorter];
                  pos += 1;
                }
              }
            }
          }
          if (!coda) coda = null;
        } else if (afterCoda < word.length && word[afterCoda] !== '.' && /[a-z]/.test(word[afterCoda])) {
          coda = Y2J_CODA[codaCandidate] || null;
          if (coda) pos += codaCandidate.length;
        } else {
          coda = Y2J_CODA[codaCandidate] || null;
          if (coda) pos += codaCandidate.length;
        }
      }
    }

    const hangul = composeHangul(onset, finalVowel, coda);
    // 합성할 수 없으면 소비한 문자열을 원형 그대로 — 모음만 남기면 초성·종성이 소리 없이 사라진다
    syllables.push(hangul || word.slice(start, pos));
  }

  return syllables.join('');
}
