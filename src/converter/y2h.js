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

// UI 레이어가 fetch 후 호출. {syllable, bigram, word} 형태로 주입
export function setFrequencyData({ syllable = null, bigram = null, word = null } = {}) {
  syllableFreq = syllable;
  bigramFreq = bigram;
  wordFreq = word;
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

// Yale → 한글 메인 진입점. 줄/공백/구두점은 그대로 보존
export function reverseConvert(text, { labial = true } = {}) {
  if (!text || !text.trim()) return '';

  const result = [];
  const lines = text.split(/(\r?\n)/);

  for (const line of lines) {
    if (/^\r?\n$/.test(line)) { result.push(line); continue; }
    const parts = line.split(/([^a-zA-Z.\-]+)/);
    for (const part of parts) {
      if (/^[a-zA-Z.\-]+$/.test(part)) {
        result.push(parseYaleWord(part.toLowerCase(), { labial }));
      } else {
        result.push(part);
      }
    }
  }
  return result.join('');
}

// '.', '-'로 세그먼트 분할 후, 자음만 있는 세그먼트는 앞 음절의 종성으로 결합
export function parseYaleWord(word, { labial = true } = {}) {
  const segments = word.split(/[.\-]/);
  const results = [];
  const parseSeg = (seg) => (syllableFreq && bigramFreq)
    ? disambiguateSegment(seg, labial)
    : parseYaleWordGreedy(seg, { labial });

  for (const seg of segments) {
    if (!seg) { results.push(''); continue; }

    const hasVowel = /[aeiou]/.test(seg);

    if (!hasVowel && results.length > 0) {
      // 자음만 → 앞 음절의 종성으로 결합 시도
      const prev = results[results.length - 1];
      if (prev.length > 0) {
        const lastChar = prev[prev.length - 1];
        if (isHangulSyllable(lastChar)) {
          const codaJamo = YALE_DOUBLE_CODA[seg] || Y2J_CODA[seg];
          if (codaJamo) {
            const SIndex = lastChar.codePointAt(0) - SBase;
            const LIndex = Math.floor(SIndex / NCount);
            const VIndex = Math.floor((SIndex % NCount) / TCount);
            const TIndex = SIndex % TCount;

            let newCoda = null;
            if (TIndex === 0) {
              newCoda = codaJamo;
            } else {
              const existingCoda = JONGSEONG[TIndex];
              const doubleCoda = DOUBLE_CODA_JOIN[existingCoda + codaJamo];
              if (doubleCoda) newCoda = doubleCoda;
            }

            if (newCoda) {
              const onset = CHOSEONG[LIndex];
              const vowel = JUNGSEONG[VIndex];
              const newChar = composeHangul(onset, vowel, newCoda);
              if (newChar) {
                results[results.length - 1] = prev.slice(0, -1) + newChar;
                continue;
              }
            }
          }
        }
      }
      results.push(seg);
    } else {
      results.push(parseSeg(seg));
    }
  }

  return results.join('');
}

// 한 word의 top-K 한글 후보를 반환. 모호성 없는 단어는 후보 1개.
// .나 -로 음절 경계가 명시되어 있거나 빈도 데이터가 없으면 best 1개만.
export function parseYaleWordCandidates(word, { labial = true } = {}, k = 5) {
  if (!word) return [];
  const w = word.toLowerCase();
  if (/[.\-]/.test(w) || !syllableFreq || !bigramFreq) {
    const best = parseYaleWord(w, { labial });
    return best ? [{ hangul: best, score: 0 }] : [];
  }
  const all = disambiguateSegment(w, labial, true);
  return Array.isArray(all) ? all.slice(0, k) : [];
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
    if (hangul) {
      syllables.push(hangul);
    } else {
      syllables.push(vowel);
    }
  }

  return syllables.join('');
}
