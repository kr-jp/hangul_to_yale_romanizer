// Hangul → Yale Romanization (client-side)

(function () {
  'use strict';

  // ===== Unicode & 표 구성 =====
  const SBase = 0xAC00;
  const LBase = 0x1100;
  const VBase = 0x1161;
  const TBase = 0x11A7;
  const LCount = 19;
  const VCount = 21;
  const TCount = 28;
  const NCount = VCount * TCount;
  const SCount = LCount * NCount;

  const CHOSEONG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const JUNGSEONG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  const JONGSEONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

  const DOUBLE_CODA_SPLIT = {
    'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ',
    'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ',
    'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ'
  };

  // Yale 매핑
  const J2Y = {
    // consonants
    'ㅂ':'p','ㄷ':'t','ㅌ':'th','ㅈ':'c','ㅉ':'cc','ㅊ':'ch','ㄱ':'k','ㅎ':'h','ㄲ':'kk','ㅋ':'kh','ㄹ':'l','ㅁ':'m','ㄴ':'n','ㅇ':'ng','ㄸ':'tt','ㅃ':'pp','ㅍ':'ph','ㅅ':'s','ㅆ':'ss',
    // vowels
    'ㅏ':'a','ㅔ':'ey','ㅐ':'ay','ㅣ':'i','ㅗ':'o','ㅚ':'oy','ㅜ':'wu','ㅓ':'e','ㅡ':'u','ㅢ':'uy','ㅛ':'yo','ㅠ':'yu','ㅑ':'ya','ㅕ':'ye','ㅖ':'yey','ㅒ':'yay','ㅘ':'wa','ㅝ':'we','ㅟ':'wi','ㅙ':'way','ㅞ':'wey'
  };

  const BILABIALS = new Set(['ㅁ','ㅂ','ㅃ','ㅍ']);

  function isHangulSyllable(ch) {
    const code = ch.codePointAt(0);
    return code >= SBase && code < (SBase + SCount);
  }

  // 한글 → 자모(호환 자모), 초성 ㅇ 제거
  function toJamo(text) {
    const out = [];
    for (const ch of text) {
      if (!isHangulSyllable(ch)) { out.push(ch); continue; }
      const SIndex = ch.codePointAt(0) - SBase;
      const LIndex = Math.floor(SIndex / NCount);
      const VIndex = Math.floor((SIndex % NCount) / TCount);
      const TIndex = SIndex % TCount;

      const onset = CHOSEONG[LIndex];
      const nucleus = JUNGSEONG[VIndex];
      let coda = JONGSEONG[TIndex];

      if (onset !== 'ㅇ') out.push(onset);
      out.push(nucleus);

      if (coda) {
        if (DOUBLE_CODA_SPLIT[coda]) {
          for (const cj of DOUBLE_CODA_SPLIT[coda]) out.push(cj);
        } else {
          out.push(coda);
        }
      }
    }
    return out.join('');
  }

  // 양순음 뒤 ㅜ
  function applyLabialRule(jamoStr) {
    const arr = Array.from(jamoStr);
    for (let i = 0; i < arr.length - 1; i++) {
      if (BILABIALS.has(arr[i]) && arr[i + 1] === 'ㅜ') {
        arr[i + 1] = 'ㅡ';
      }
    }
    return arr.join('');
  }

  // 자모 → Yale 기호로 변환하면서, 비-자모(공백/문장부호 등)를 구분 토큰으로 유지
  function tokenizeYale(jamoStr) {
    const tokens = [];
    for (const ch of jamoStr) {
      if (Object.prototype.hasOwnProperty.call(J2Y, ch)) {
        tokens.push({ s: J2Y[ch], delim: false });
      } else {
        tokens.push({ s: ch, delim: true });
      }
    }
    return tokens;
  }

  // 구분자(sep)는 연속된 "자모 토큰" 사이에만 넣고, 공백/개행/문장부호 앞뒤에는 넣지 않음
  function joinWithSep(tokens, sep) {
    if (!sep) return tokens.map(t => t.s).join('');
    let out = '';
    for (let i = 0; i < tokens.length; i++) {
      const cur = tokens[i];
      out += cur.s;
      const next = tokens[i + 1];
      if (!next) break;
      if (!cur.delim && !next.delim) {
        out += sep;
      }
    }
    return out;
  }

  function convert(text, { labial = true, sep = '' } = {}) {
    if (!text || !text.trim()) return '';
    let jamo = toJamo(text);
    if (labial) jamo = applyLabialRule(jamo);
    const tokens = tokenizeYale(jamo);
    return joinWithSep(tokens, sep);
  }

  // ===== Yale → 한글 역변환 =====

  // Yale → 자모 역매핑 테이블 (자동 생성)
  const Y2J = {};
  for (const [jamo, yale] of Object.entries(J2Y)) {
    Y2J[yale] = jamo;
  }

  // 초성/중성/종성으로 사용 가능한 자모 집합
  const ONSET_SET = new Set(CHOSEONG);
  const VOWEL_SET = new Set(JUNGSEONG);
  const CODA_SET = new Set(JONGSEONG.filter(Boolean));

  // 겹받침 결합 테이블 (역방향: 두 자모 → 겹받침)
  const DOUBLE_CODA_JOIN = {};
  for (const [compound, parts] of Object.entries(DOUBLE_CODA_SPLIT)) {
    DOUBLE_CODA_JOIN[parts] = compound;
  }

  // Yale 자음 (초성/종성으로 사용 가능)
  const YALE_CONSONANTS = new Set([
    'pp','p','ph','tt','t','th','cc','c','ch','kk','k','kh',
    'ss','s','h','l','m','n','ng'
  ]);

  // Yale 모음
  const YALE_VOWELS = new Set([
    'way','wey','yey','yay',
    'wa','we','wi','wu','wo',
    'ya','ye','yo','yu',
    'ay','ey','oy','uy',
    'a','e','i','o','u'
  ]);

  // Yale 종성으로 사용 가능한 자음 (ㅊ, ㅋ, ㅌ, ㅍ, ㅎ 포함)
  const YALE_CODAS = new Set([
    'kk','k','kh','ss','s','n','ng','l','m','p','ph','t','th','c','ch','h'
  ]);

  // Yale → 자모 역매핑 (종성 전용)
  const Y2J_CODA = {
    'k':'ㄱ','kk':'ㄲ','n':'ㄴ','t':'ㄷ','l':'ㄹ','m':'ㅁ','p':'ㅂ',
    's':'ㅅ','ss':'ㅆ','ng':'ㅇ','c':'ㅈ','ch':'ㅊ','kh':'ㅋ','th':'ㅌ','ph':'ㅍ','h':'ㅎ'
  };

  // 겹받침 가능 조합 (Yale 종성 두 개 → 겹받침 자모)
  const YALE_DOUBLE_CODA = {
    'ks':'ㄳ', 'nc':'ㄵ', 'nh':'ㄶ',
    'lk':'ㄺ', 'lm':'ㄻ', 'lp':'ㄼ', 'ls':'ㄽ',
    'lth':'ㄾ', 'lph':'ㄿ', 'lh':'ㅀ', 'ps':'ㅄ'
  };

  // Yale 초성 전용 집합 (ng는 종성 전용이므로 제외)
  const YALE_ONSETS = new Set([
    'pp','p','ph','tt','t','th','cc','c','ch','kk','k','kh',
    'ss','s','h','l','m','n'
  ]);

  // ===== 음절 빈도 데이터 (비동기 로딩) =====
  let syllableFreq = null;   // {"한": -2.085, ...}
  let bigramFreq = null;     // {"한국": -5.058, "국어": -5.328, ...}
  let wordFreq = null;       // {"작업": -3.2, "한국어": -3.8, ...}

  (function loadFreqData() {
    fetch('data/syllable-freq.json')
      .then(r => r.json())
      .then(data => {
        syllableFreq = data.u || null;
        bigramFreq = data.b || null;
        wordFreq = data.w || null;
        // 데이터 로딩 후 현재 입력 재변환
        updateAll();
      })
      .catch((err) => {
        console.warn('[Yale] 빈도 데이터 로딩 실패, 기본 파서 사용:', err);
      });
  })();

  // 최장 일치로 Yale 문자열에서 토큰 추출
  function matchYaleToken(str, pos, tokenSet) {
    // 길이 3, 2, 1 순으로 최장 일치 시도
    for (let len = 3; len >= 1; len--) {
      const sub = str.slice(pos, pos + len);
      if (tokenSet.has(sub)) return sub;
    }
    return null;
  }

  // 한글 음절 합성: 초성 + 중성 + 종성(옵션) → 완성형 한글
  function composeHangul(onset, vowel, coda) {
    const li = CHOSEONG.indexOf(onset);
    const vi = JUNGSEONG.indexOf(vowel);
    if (li < 0 || vi < 0) return '';
    let ti = 0;
    if (coda) {
      ti = JONGSEONG.indexOf(coda);
      if (ti < 0) ti = 0;
    }
    return String.fromCharCode(SBase + li * NCount + vi * TCount + ti);
  }

  // Yale → 한글 변환 메인 함수
  function reverseConvert(text, { labial = true } = {}) {
    if (!text || !text.trim()) return '';

    const result = [];
    const lines = text.split(/(\r?\n)/);

    for (const line of lines) {
      // 개행은 그대로 유지
      if (/^\r?\n$/.test(line)) { result.push(line); continue; }

      // 단어 단위로 분리 (공백/구두점 등은 그대로 유지)
      const parts = line.split(/([^a-zA-Z.\-]+)/);
      for (const part of parts) {
        // 알파벳과 ./- 포함된 부분은 Yale로 파싱 시도
        if (/^[a-zA-Z.\-]+$/.test(part)) {
          result.push(parseYaleWord(part.toLowerCase(), { labial }));
        } else {
          result.push(part);
        }
      }
    }
    return result.join('');
  }

  // Yale 단어를 파싱하여 한글로 변환
  // '.'과 '-'로 세그먼트 분할 후, 자음만 있는 세그먼트는 앞 음절의 종성으로 결합
  // (smart/greedy 공통 처리)
  function parseYaleWord(word, { labial = true } = {}) {
    const segments = word.split(/[.\-]/);
    const results = [];
    // 빈도 데이터 유무에 따라 파서 선택
    const parseSeg = (seg) => (syllableFreq && bigramFreq)
      ? disambiguateSegment(seg, labial)
      : parseYaleWordGreedy(seg, { labial });

    for (const seg of segments) {
      if (!seg) { results.push(''); continue; }

      // 세그먼트에 모음이 있는지 확인 (a, e, i, o, u)
      const hasVowel = /[aeiou]/.test(seg);

      if (!hasVowel && results.length > 0) {
        // 자음만 있는 세그먼트 → 앞 음절의 종성으로 결합 시도
        const prev = results[results.length - 1];
        if (prev.length > 0) {
          const lastChar = prev[prev.length - 1];
          if (isHangulSyllable(lastChar)) {
            // Yale 자음 → 종성 자모 변환 (겹받침 우선)
            const codaJamo = YALE_DOUBLE_CODA[seg] || Y2J_CODA[seg];
            if (codaJamo) {
              const SIndex = lastChar.codePointAt(0) - SBase;
              const LIndex = Math.floor(SIndex / NCount);
              const VIndex = Math.floor((SIndex % NCount) / TCount);
              const TIndex = SIndex % TCount;

              let newCoda = null;
              if (TIndex === 0) {
                // 기존 종성 없음 → 새 종성 추가
                newCoda = codaJamo;
              } else {
                // 기존 종성 있음 → 겹받침 결합 시도
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
        // 결합 불가 시 그대로 추가
        results.push(seg);
      } else {
        results.push(parseSeg(seg));
      }
    }

    return results.join('');
  }

  // ===== 스마트 파서: 그래프 기반 음절 분할 + 빈도 스코어링 =====

  // 지정 위치에서 가능한 모든 토큰 반환 (최장→최단 순)
  function allTokensAt(str, pos, tokenSet) {
    const results = [];
    for (let len = 3; len >= 1; len--) {
      if (pos + len > str.length) continue;
      const sub = str.slice(pos, pos + len);
      if (tokenSet.has(sub)) results.push(sub);
    }
    return results;
  }

  // 하나의 Yale 세그먼트를 그래프 기반으로 음절 분할
  function disambiguateSegment(seg, labial) {
    const n = seg.length;
    if (n === 0) return '';

    // 음절 그래프 구축: edges[i] = [{end, hangul}]
    const edges = Array.from({ length: n }, () => []);

    for (let i = 0; i < n; i++) {
      if (!/[a-z]/.test(seg[i])) continue;

      // A) 초성 없이 모음으로 시작 (ㅇ 자동 삽입)
      const vowelsAtI = allTokensAt(seg, i, YALE_VOWELS);
      for (const v of vowelsAtI) {
        const vJamo = Y2J[v];
        const afterV = i + v.length;
        // 종성 없음
        const h0 = composeHangul('ㅇ', vJamo, null);
        if (h0) edges[i].push({ end: afterV, hangul: h0 });
        // 단일 종성
        addCodaEdgesGraph(seg, afterV, 'ㅇ', vJamo, edges[i]);
        // 겹받침
        addDoubleCodaEdgesGraph(seg, afterV, 'ㅇ', vJamo, edges[i]);
      }

      // B) 초성 자음 있음
      const onsetsAtI = allTokensAt(seg, i, YALE_ONSETS);
      for (const c of onsetsAtI) {
        const cJamo = Y2J[c] || 'ㅇ';
        const afterC = i + c.length;
        const vowelsAfterC = allTokensAt(seg, afterC, YALE_VOWELS);
        for (const v of vowelsAfterC) {
          let vJamo = Y2J[v];
          const afterV = afterC + v.length;

          // 양순음 규칙: 양순음 뒤 'u' → ㅜ(기본) 와 ㅡ(대안) 양쪽 에지 생성
          // ㅜ가 Yale 양순음 규칙의 기본 해석이므로 ㅡ 에지에 패널티 부여
          const isLabialU = labial && v === 'u' && BILABIALS.has(cJamo);
          if (isLabialU) {
            // ㅜ 버전 에지 (기본, 보너스 없음)
            const vWu = 'ㅜ';
            const hWu0 = composeHangul(cJamo, vWu, null);
            if (hWu0) edges[i].push({ end: afterV, hangul: hWu0 });
            addCodaEdgesGraph(seg, afterV, cJamo, vWu, edges[i]);
            addDoubleCodaEdgesGraph(seg, afterV, cJamo, vWu, edges[i]);
          }

          // 기본 모음 에지 (양순음+u의 경우 ㅡ 대안에 패널티)
          const labialAltPenalty = isLabialU ? -1.5 : 0;
          const h0 = composeHangul(cJamo, vJamo, null);
          if (h0) edges[i].push({ end: afterV, hangul: h0, bonus: labialAltPenalty });
          // 단일 종성
          addCodaEdgesGraph(seg, afterV, cJamo, vJamo, edges[i], labialAltPenalty);
          // 겹받침
          addDoubleCodaEdgesGraph(seg, afterV, cJamo, vJamo, edges[i], labialAltPenalty);
        }
      }
    }

    // 빔 서치 DP로 최적 경로 탐색 (top-K 후보 유지)
    const PENALTY_UNI = -8.0; // 미등록 음절 페널티 (기존 음절 범위: -1.5~-5.5)
    const W_BI = 0.7;        // 바이그램 가중치 (유니그램 대비 상대적 영향력)
    const BI_MISS_BASE = -13.0; // 미등록 바이그램 기본 페널티 (W_BI 로 스케일링)
    const BEAM_K = 5;         // 빔 폭 (각 위치에서 유지할 최대 후보 수)
    const W_WORD_2 = 1.5;    // 2음절 단어 보너스
    const W_WORD_3 = 3.5;    // 3+음절 단어 보너스

    // dp[i] = [{ score, prevPos, prevIdx, hangul, lastSyl, prevSyl }, ...]
    const dp = Array.from({ length: n + 1 }, () => []);
    dp[0].push({ score: 0, prevPos: -1, prevIdx: -1, hangul: '', lastSyl: '', prevSyl: '' });

    for (let i = 0; i <= n; i++) {
      // 빔 가지치기: 처리 전에 수행하여 prevIdx 안정성 보장
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
            // 등록된 바이그램: 가중치 적용, 미등록: W_BI 에 비례한 페널티
            biScore = (bFreq !== undefined) ? (W_BI * bFreq) : (W_BI * BI_MISS_BASE);
          }
          // 단어 보너스: 사전에 등록된 단어 시퀀스에 추가 점수
          let wordBonus = 0;
          if (wordFreq) {
            // 2음절 단어 매칭
            if (cand.lastSyl && wordFreq[cand.lastSyl + edge.hangul] !== undefined) {
              wordBonus = W_WORD_2;
            }
            // 3음절 단어 매칭 (더 높은 보너스)
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
            prevSyl: cand.lastSyl
          });
        }
      }
    }

    // 빔 서치로 도달 불가능하면 탐욕 파서로 폴백
    if (!dp[n].length) {
      return parseYaleWordGreedy(seg, { labial });
    }

    // 최적 후보 선택
    let bestIdx = 0;
    for (let ci = 1; ci < dp[n].length; ci++) {
      if (dp[n][ci].score > dp[n][bestIdx].score) bestIdx = ci;
    }

    // 역추적으로 음절 열 복원
    const result = [];
    let pos = n, idx = bestIdx;
    while (pos > 0 && dp[pos][idx]) {
      result.unshift(dp[pos][idx].hangul);
      const c = dp[pos][idx];
      pos = c.prevPos;
      idx = c.prevIdx;
    }
    return result.join('');
  }

  // 단일 종성 에지 추가
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

  // 겹받침 에지 추가
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

  // (parseYaleWordSmart 는 parseYaleWord 에 통합됨 — 세그먼트 분할+자음 결합은 parseYaleWord 에서 처리)

  // ===== 탐욕 파서 (기존 로직, 폴백용) =====

  // 하나의 Yale 단어를 탐욕적으로 파싱하여 한글로 변환
  function parseYaleWordGreedy(word, { labial = true } = {}) {
    const syllables = [];
    let pos = 0;

    while (pos < word.length) {
      // '.' 또는 '-'는 음절/형태소 경계 표시 → 건너뜀
      if (word[pos] === '.' || word[pos] === '-') { pos++; continue; }

      // 비-알파벳 문자는 패스스루
      if (!/[a-z]/.test(word[pos])) {
        syllables.push(word[pos]);
        pos++;
        continue;
      }

      // 음절 파싱: (C)V(C) 구조
      let onset = 'ㅇ'; // 기본 초성은 ㅇ (무음)
      let vowel = null;
      let coda = null;

      // 1) 초성 자음 시도
      const consonant = matchYaleToken(word, pos, YALE_CONSONANTS);
      if (consonant) {
        // 자음 뒤에 모음이 오는지 확인
        const afterC = pos + consonant.length;
        const nextVowel = matchYaleToken(word, afterC, YALE_VOWELS);
        if (nextVowel) {
          // 자음 + 모음 → 자음은 초성
          onset = Y2J[consonant] || 'ㅇ';
          pos = afterC;
        } else {
          // 자음 뒤에 모음 없음 → 이전 음절의 종성이거나 독립 자음
          // 이 경우 모음부터 시작하는지 다시 확인
          const directVowel = matchYaleToken(word, pos, YALE_VOWELS);
          if (directVowel) {
            // 실제로는 모음으로 시작 (e.g., 'a', 'e' 등)
            onset = 'ㅇ';
          } else {
            // 변환 불가능한 문자열 → 그대로 출력
            syllables.push(word[pos]);
            pos++;
            continue;
          }
        }
      }

      // 2) 중성 모음 파싱
      vowel = matchYaleToken(word, pos, YALE_VOWELS);
      if (!vowel) {
        // 모음 없음 → 유효한 음절 아님, 그대로 출력
        syllables.push(word[pos]);
        pos++;
        continue;
      }
      const vowelJamo = Y2J[vowel];
      pos += vowel.length;

      // 양순음 규칙 역적용: 양순음 뒤의 'u'는 원래 ㅜ일 수 있음
      let finalVowel = vowelJamo;
      if (labial && vowel === 'u' && BILABIALS.has(onset)) {
        finalVowel = 'ㅜ';
      }

      // 3) 종성 파싱 (선택)
      coda = null;

      // 겹받침 시도 (lk, lm, lp, ls, lth, lph, lh, ks, nc, nh, ps)
      for (let dcLen = 3; dcLen >= 2; dcLen--) {
        const dcCandidate = word.slice(pos, pos + dcLen);
        if (YALE_DOUBLE_CODA[dcCandidate]) {
          // 겹받침 뒤에 모음이 오면 안됨 (두 번째 자음이 다음 음절의 초성일 수 있음)
          const afterDC = pos + dcLen;
          const nextAfterDC = matchYaleToken(word, afterDC, YALE_VOWELS);
          if (!nextAfterDC && (afterDC >= word.length || word[afterDC] === '.' || !/[a-z]/.test(word[afterDC]) || matchYaleToken(word, afterDC, YALE_CONSONANTS))) {
            coda = YALE_DOUBLE_CODA[dcCandidate];
            pos += dcLen;
            break;
          }
        }
      }

      // 단일 종성 시도 (겹받침이 아닌 경우)
      if (!coda) {
        const codaCandidate = matchYaleToken(word, pos, YALE_CODAS);
        if (codaCandidate) {
          const afterCoda = pos + codaCandidate.length;

          // 종성 뒤에 모음이 오면 → 분할 시도 또는 다음 음절의 초성으로 처리
          const nextVowelAfterCoda = matchYaleToken(word, afterCoda, YALE_VOWELS);
          if (nextVowelAfterCoda) {
            // 동일 문자 반복 다이그래프(kk, ss)만 분할: 첫 자음은 종성, 나머지는 다음 초성
            // ch, kh, ph, th, ng 등 이음자(aspirate/기타)는 분할하지 않음
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
            // 분할 불가능 시 → 종성 없이 음절 완성, 자음은 다음 루프에서 초성으로 처리
            if (!coda) coda = null;
          } else if (afterCoda < word.length && word[afterCoda] !== '.' && /[a-z]/.test(word[afterCoda])) {
            // 종성 뒤에 자음이 옴 → 현재 자음은 종성
            coda = Y2J_CODA[codaCandidate] || null;
            if (coda) pos += codaCandidate.length;
          } else {
            // 단어 끝 또는 구분자 → 종성
            coda = Y2J_CODA[codaCandidate] || null;
            if (coda) pos += codaCandidate.length;
          }
        }
      }

      // 음절 합성
      const hangul = composeHangul(onset, finalVowel, coda);
      if (hangul) {
        syllables.push(hangul);
      } else {
        // 합성 실패 시 원본 유지
        syllables.push(vowel);
      }
    }

    return syllables.join('');
  }

  // ===== DOM =====
  const $in = document.getElementById('input');
  const $out = document.getElementById('output');
  const $sep = document.getElementById('separator');
  const $lab = document.getElementById('labialRule');
  const $copy = document.getElementById('copyBtn');
  const $status = document.getElementById('status');
  const $toast = document.getElementById('toast');
  const $dirToggle = document.getElementById('directionToggle');

  // 변환 방향: 'h2y' (한글→Yale) 또는 'y2h' (Yale→한글)
  let conversionDir = 'h2y';

  const $interlinearMode = document.getElementById('interlinearMode');
  const $interPanel = document.getElementById('interlinearPanel');
  const $interlinear = document.getElementById('interlinear');
  const $sepPreview = document.getElementById('sepPreview');
  const $sepChips = document.getElementById('sepChips');
  const $sepEnable = document.getElementById('sepEnable');
  const $sepControls = document.getElementById('sepControls');

  const $openRef = document.getElementById('openRef');
  const $closeRef = document.getElementById('closeRef');
  const $refDrawer = document.getElementById('refDrawer');
  const $refBody = document.getElementById('refBody');

  const $openHist = document.getElementById('openHist');
  const $closeHist = document.getElementById('closeHist');
  const $histDrawer = document.getElementById('historyDrawer');
  const $histList = document.getElementById('histList');
  const $clearHist = document.getElementById('clearHist');
  const $themeToggle = document.getElementById('themeToggle');
  const $backdrop = document.getElementById('backdrop');
  const $langToggle = document.getElementById('langToggle');
  const $labelInput = document.getElementById('labelInput');
  const $labelOutput = document.getElementById('labelOutput');
  const $labelLabial = document.getElementById('labelLabial');
  const $labelInterlinear = document.getElementById('labelInterlinear');
  const $labelSep = document.getElementById('labelSep');
  const $ttlInterlinear = document.getElementById('ttlInterlinear');
  const $hintInterlinear = document.getElementById('hintInterlinear');
  const $hintY2H = document.getElementById('hintY2H');
  const $ttlRef = document.getElementById('ttlRef');
  const $ttlHist = document.getElementById('ttlHist');
  let COPIED_TEXT = 'Copied!';
  let currentLang = 'ja';

  // 토스트 알림 표시
  let _toastTimer = null;
  function showToast(msg) {
    if (!$toast) return;
    clearTimeout(_toastTimer);
    $toast.textContent = msg;
    $toast.classList.add('show');
    _toastTimer = setTimeout(() => { $toast.classList.remove('show'); }, 2000);
  }

  // ===== 렌더링 =====
  function getOpts() {
    const sep = ($sepEnable && !$sepEnable.checked) ? '' : ($sep.value || '').slice(0, 1);
    const labial = !!$lab.checked;
    return { sep, labial };
  }

  function splitLines(text) {
    return (text || '')
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function updateSingle() {
    const opts = getOpts();
    if (conversionDir === 'y2h') {
      $out.value = reverseConvert($in.value, opts);
    } else {
      $out.value = convert($in.value, opts);
    }
  }

  function renderInterlinear(lines, opts) {
    $interlinear.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const line of lines) {
      const block = document.createElement('div');
      block.className = 'inter-block';
      const tokens = line.split(/\s+/).filter(Boolean);
      const romas = conversionDir === 'y2h'
        ? tokens.map(t => reverseConvert(t, opts))
        : tokens.map(t => convert(t, opts));
      const top = document.createElement('div');
      top.className = 'line top mono';
      top.textContent = tokens.join(' ');
      const bottom = document.createElement('div');
      bottom.className = 'line bottom mono';
      bottom.textContent = romas.join(' ');
      block.appendChild(top); block.appendChild(bottom);

      // 클릭 시: 탭으로 구분된 2행 복사
      block.addEventListener('click', async () => {
        const tsv = tokens.join('\t') + '\n' + romas.join('\t');
        try {
          await navigator.clipboard.writeText(tsv);
          showToast(COPIED_TEXT);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = tsv; document.body.appendChild(ta);
          ta.select(); document.execCommand('copy'); ta.remove();
          showToast(COPIED_TEXT);
        }
      });
      frag.appendChild(block);
    }
    $interlinear.appendChild(frag);
  }

  function togglePanels(lines, opts) {
    const il = $interlinearMode.checked;
    if (il) {
      $interPanel.classList.remove('hidden');
      $interPanel.setAttribute('aria-hidden', 'false');
      renderInterlinear(lines, opts);
    } else {
      $interPanel.classList.add('hidden');
      $interPanel.setAttribute('aria-hidden', 'true');
    }
  }

  function updateAll() {
    const opts = getOpts();
    updateSingle();
    const lines = splitLines($in.value);
    togglePanels(lines, opts);
    persistHistoryDebounced();
    // update separator preview and chips
    if ($sepPreview) $sepPreview.textContent = opts.sep ? (opts.sep === ' ' ? '␣' : opts.sep) : '∅';
    if ($sepChips) {
      const buttons = Array.from($sepChips.querySelectorAll('.chip'));
      buttons.forEach(b => b.classList.toggle('active', (b.dataset.sep || '') === opts.sep));
    }
    if ($sepControls) $sepControls.classList.toggle('hidden', conversionDir === 'y2h' || !$sepEnable?.checked);
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(COPIED_TEXT);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove();
      showToast(COPIED_TEXT);
    }
  }

  // === Auto-copy: 입력창과 출력창 모두에서 선택된 텍스트를 자동 복사 ===

  // 선택된 텍스트 얻기 (범용)
  function getSelectedFromTextarea(textarea) {
    if (!textarea) return '';
    if (typeof textarea.selectionStart === 'number' && typeof textarea.selectionEnd === 'number') {
      const s = textarea.selectionStart, e = textarea.selectionEnd;
      return (e > s) ? textarea.value.slice(s, e) : '';
    }
    // 폴백(향후 엘리먼트 변경 대비)
    const sel = window.getSelection && window.getSelection();
    return sel ? String(sel) : '';
  }

  // 선택 종료 직후 한 번만 복사
  let _autoCopyTimer = null;
  function autoCopySelected(textarea, isOutput = false) {
    clearTimeout(_autoCopyTimer);
    // selection 갱신 직후를 기다리기 위해 약간 지연
    _autoCopyTimer = setTimeout(() => {
      const sel = getSelectedFromTextarea(textarea);
      if (!sel) return;
      let textToCopy = sel;
      // 출력창의 경우에만 공백을 탭으로 변환
      if (isOutput) {
        textToCopy = sel.replace(/[^\S\r\n]+/g, '\t');
      }
      copy(textToCopy);   // 기존 copy() 재사용 → i18n 상태문구 표시
    }, 10);
  }

  // 입력창($in)에 자동 복사 기능 추가
  if ($in) {
    $in.addEventListener('mouseup', () => autoCopySelected($in, false));
    $in.addEventListener('touchend', () => autoCopySelected($in, false), { passive: true });
    $in.addEventListener('keyup', (e) => {
      const key = e.key || '';
      if (e.shiftKey || key.startsWith('Arrow') || (key.toLowerCase() === 'a' && (e.metaKey || e.ctrlKey))) {
        autoCopySelected($in, false);
      }
    });
  }

  // 출력창($out)에 자동 복사 기능
  if ($out) {
    $out.addEventListener('mouseup', () => autoCopySelected($out, true));
    $out.addEventListener('touchend', () => autoCopySelected($out, true), { passive: true });
    $out.addEventListener('keyup', (e) => {
      const key = e.key || '';
      if (e.shiftKey || key.startsWith('Arrow') || (key.toLowerCase() === 'a' && (e.metaKey || e.ctrlKey))) {
        autoCopySelected($out, true);
      }
    });
  }  

  // ===== 히스토리 (localStorage) =====
  const HIST_KEY = 'yaleHistoryV1';
  const HIST_MAX = 10;

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); }
    catch { return []; }
  }

  function saveHistory(arr) {
    localStorage.setItem(HIST_KEY, JSON.stringify(arr));
  }

  function addHistory() {
    const text = ($in.value || '').trim();
    if (!text) return;
    const opts = getOpts();
    const item = {
      id: Date.now(),
      text,
      opts,
      ts: new Date().toISOString(),
      pinned: false
    };
    let hist = loadHistory();

    // 동일 텍스트+옵션 중복 제거
    hist = hist.filter(h => !(h.text === item.text && JSON.stringify(h.opts) === JSON.stringify(item.opts)));

    const pinned = hist.filter(h => h.pinned);
    const others = hist.filter(h => !h.pinned);
    others.unshift(item);
    // 최대 길이 제한(핀 제외)
    while (others.length > HIST_MAX) others.pop();
    const next = [...pinned, ...others].sort((a,b) => (b.pinned - a.pinned) || (b.id - a.id));
    saveHistory(next);
  }

  let histTimer = null;
  function persistHistoryDebounced() {
    clearTimeout(histTimer);
    histTimer = setTimeout(addHistory, 500);
  }

  function renderHistory() {
    const hist = loadHistory().sort((a,b) => (b.pinned - a.pinned) || (b.id - a.id));
    $histList.innerHTML = '';
    if (hist.length === 0) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = (I18N[currentLang] || I18N.ja).emptyHist;
      $histList.appendChild(p);
      return;
    }
    for (const h of hist) {
      const div = document.createElement('div');
      div.className = 'history-item';
      const firstLine = (h.text.split(/\r?\n/)[0] || '').slice(0, 80);

      // メタ情報
      const meta = document.createElement('div');
      meta.className = 'hist-meta';
      const tsBadge = document.createElement('span');
      tsBadge.className = 'badge';
      tsBadge.textContent = new Date(h.id).toLocaleString();
      meta.appendChild(tsBadge);
      if (h.pinned) {
        const pinBadge = document.createElement('span');
        pinBadge.className = 'badge pin';
        pinBadge.textContent = 'PIN';
        meta.appendChild(pinBadge);
      }
      const sepBadge = document.createElement('span');
      sepBadge.className = 'badge';
      sepBadge.textContent = 'sep:' + (h.opts.sep || '∅');
      meta.appendChild(sepBadge);
      const labBadge = document.createElement('span');
      labBadge.className = 'badge';
      labBadge.textContent = h.opts.labial ? 'labial:on' : 'labial:off';
      meta.appendChild(labBadge);

      // テキストプレビュー（textContentでXSS防止）
      const mono = document.createElement('div');
      mono.className = 'mono';
      mono.textContent = firstLine + (h.text.length > 80 ? '…' : '');

      // 操作ボタン
      const tools = document.createElement('div');
      tools.className = 'hist-tools';
      for (const [act, label] of [['restore','Restore'],['pin', h.pinned ? 'Unpin' : 'Pin'],['delete','Delete']]) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline';
        btn.dataset.act = act;
        btn.dataset.id = h.id;
        btn.textContent = label;
        tools.appendChild(btn);
      }

      div.appendChild(meta);
      div.appendChild(mono);
      div.appendChild(tools);
      $histList.appendChild(div);
    }
  }

  $histList?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    let hist = loadHistory();
    const idx = hist.findIndex(h => h.id === id);
    if (idx < 0) return;

    const act = btn.dataset.act;
    if (act === 'restore') {
      const h = hist[idx];
      $in.value = h.text;
      $sep.value = h.opts.sep || '';
      $lab.checked = !!h.opts.labial;
      updateAll();
    } else if (act === 'pin') {
      hist[idx].pinned = !hist[idx].pinned;
      saveHistory(hist);
      renderHistory();
    } else if (act === 'delete') {
      hist.splice(idx,1);
      saveHistory(hist);
      renderHistory();
    }
  });

  $clearHist?.addEventListener('click', () => {
    saveHistory([]);
    renderHistory();
  });

  // ===== 참조표 =====
  function makeSection(title, entries) {
    const wrap = document.createElement('div');
    wrap.className = 'map-section';
    wrap.innerHTML = `<div class="ttl">${title}</div>`;
    const body = document.createElement('div');
    body.className = 'body';
    for (const [j, y] of entries) {
      const cell = document.createElement('div');
      cell.className = 'map-cell';
      cell.title = `${j} → ${y}`;
      cell.innerHTML = `${j}<small>${y}</small>`;
      body.appendChild(cell);
    }
    wrap.appendChild(body);
    return wrap;
  }

  function buildRefTable() {
    const grid = document.createElement('div');
    grid.className = 'map-grid';

    // 초성: ㅇ은 초성에서 ∅(생략) 안내
    const onsetEntries = CHOSEONG.map(j => [
      j,
      j === 'ㅇ' ? '∅' : (J2Y[j] || '—')   // 초성에서만 ∅로 표시
    ]);
    const nucleusEntries = JUNGSEONG.map(j => [j, J2Y[j] || '—']);
    // 종성은 분해쌍도 함께 표시(단, 표시는 기본자모 중심)
    const codaSet = new Set(JONGSEONG.filter(Boolean).flatMap(j => (DOUBLE_CODA_SPLIT[j] ? DOUBLE_CODA_SPLIT[j].split('') : [j])));
    const codaEntries = Array.from(codaSet).map(j => [j, J2Y[j] || '—']);

    grid.appendChild(makeSection('初声(초성)', onsetEntries));
    grid.appendChild(makeSection('中声(중성)', nucleusEntries));
    grid.appendChild(makeSection('終声(종성)', codaEntries));

    $refBody.innerHTML = '';
    $refBody.appendChild(grid);
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = (I18N[currentLang] || I18N.ja).refNote;
    $refBody.appendChild(note);
    // リンク部分
    const link = document.createElement('a');
    link.href = 'https://ja.wikipedia.org/wiki/%E3%82%A4%E3%82%A7%E3%83%BC%E3%83%AB%E5%BC%8F#%E6%9C%9D%E9%AE%AE%E8%AA%9E';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Wikipedia';
    link.className = 'btn btn-outline';
    // p 要素に追加
    note.appendChild(link);
    $refBody.appendChild(note);
  }

  // ===== 드로어 토글 =====
  function openDrawer($el, $btn) {
    $el.classList.add('open');
    $el.setAttribute('aria-hidden', 'false');
    if ($btn) $btn.setAttribute('aria-expanded', 'true');
    if ($backdrop) $backdrop.hidden = false;
  }
  function closeDrawer($el, $btn) {
    $el.classList.remove('open');
    $el.setAttribute('aria-hidden', 'true');
    if ($btn) $btn.setAttribute('aria-expanded', 'false');
    if ($backdrop && !$refDrawer.classList.contains('open') && !$histDrawer.classList.contains('open')) {
      $backdrop.hidden = true;
    }
  }

  $openRef?.addEventListener('click', () => { buildRefTable(); openDrawer($refDrawer, $openRef); });
  $closeRef?.addEventListener('click', () => closeDrawer($refDrawer, $openRef));
  $openHist?.addEventListener('click', () => { renderHistory(); openDrawer($histDrawer, $openHist); });
  $closeHist?.addEventListener('click', () => closeDrawer($histDrawer, $openHist));

  // ===== 이벤트 =====
  function onShortcut(e) {
    const meta = e.ctrlKey || e.metaKey;
    if (meta && e.key === 'Enter') { e.preventDefault(); updateAll(); }
  }

  $in.addEventListener('input', updateAll);
  $sep.addEventListener('input', updateAll);
  $sepEnable?.addEventListener('change', updateAll);
  $lab.addEventListener('change', updateAll);
  $interlinearMode.addEventListener('change', updateAll);
  document.addEventListener('keydown', onShortcut);

  // 방향 전환 토글
  function applyDirection(dir) {
    conversionDir = dir;
    const T = I18N[currentLang] || I18N.ja;
    const btns = $dirToggle.querySelectorAll('.dir-btn');
    btns.forEach(b => {
      const isActive = b.dataset.dir === dir;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-checked', String(isActive));
    });
    // 방향에 따라 라벨과 플레이스홀더 변경
    if (dir === 'y2h') {
      $labelInput.textContent = T.labelInputY2H || 'Yale';
      $labelOutput.textContent = T.labelOutputY2H || '한글';
      $in.setAttribute('placeholder', T.placeholderY2H || 'hankwuk-e');
      // y2h 모드에서는 구분자 옵션 숨김, 경계 힌트 표시
      if ($sepEnable) $sepEnable.closest('.switch').classList.add('hidden');
      if ($sepControls) $sepControls.classList.add('hidden');
      if ($hintY2H) {
        $hintY2H.textContent = T.hintY2H || '';
        $hintY2H.classList.remove('hidden');
      }
    } else {
      $labelInput.textContent = T.labelInput;
      $labelOutput.textContent = T.labelOutput;
      $in.setAttribute('placeholder', T.placeholderH2Y || '입력 대기 중');
      if ($sepEnable) $sepEnable.closest('.switch').classList.remove('hidden');
      if ($hintY2H) $hintY2H.classList.add('hidden');
    }
    $in.value = '';
    updateAll();
  }

  $dirToggle?.addEventListener('click', (e) => {
    const btn = e.target.closest('.dir-btn');
    if (!btn || btn.classList.contains('active')) return;
    applyDirection(btn.dataset.dir);
  });

  $copy.addEventListener('click', () => {
    // 개행(\r, \n)은 유지하고, 그 외 공백(스페이스/전각 스페이스 등)을 탭으로 치환
    const raw = $out.value || '';
    const tabbed = raw.replace(/[^\S\r\n]+/g, '\t'); // 공백(whitespace) 중 개행 제외
    copy(tabbed);
  });
  

  // separator chips
  $sepChips?.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    const val = btn.dataset.sep ?? '';
    $sep.value = val;
    updateAll();
  });

  // 메인 화면 클릭으로 드로어 닫기
  document.addEventListener('click', (e) => {
    const clickedInsideRef = e.target.closest?.('#refDrawer, #openRef, #closeRef');
    const clickedInsideHist = e.target.closest?.('#historyDrawer, #openHist, #closeHist, #histList, .drawer-tools');
    if (!clickedInsideRef && $refDrawer.classList.contains('open')) closeDrawer($refDrawer, document.getElementById('openRef'));
    if (!clickedInsideHist && $histDrawer.classList.contains('open')) closeDrawer($histDrawer, document.getElementById('openHist'));
  });

  // backdrop 클릭으로 닫기
  $backdrop?.addEventListener('click', () => {
    if ($refDrawer.classList.contains('open')) closeDrawer($refDrawer, $openRef);
    if ($histDrawer.classList.contains('open')) closeDrawer($histDrawer, $openHist);
  });

  // 테마 토글 초기화
  (function initTheme(){
    const KEY = 'yaleThemeV1';
    const root = document.documentElement;
    function apply(theme){
      root.setAttribute('data-theme', theme);
      if ($themeToggle) {
        const light = theme === 'light';
        $themeToggle.setAttribute('aria-pressed', String(!light));
        $themeToggle.textContent = light ? '☀️' : '🌙';
      }
    }
    const saved = localStorage.getItem(KEY);
    // 기본값을 'dark'로 고정
    apply(saved || 'dark');
    $themeToggle?.addEventListener('click', () => {
      const next = (root.getAttribute('data-theme') === 'light') ? 'dark' : 'light';
      localStorage.setItem(KEY, next);
      apply(next);
    });
  })();

  // 언어 토글(i18n)
  const I18N = {
    ja: {
      openHist: '変換履歴', openRef: 'イェール式参照', copyBtn: '変換結果コピー', labelInput: '入力（ハングル）', labelOutput: '変換結果', labelLabial: '両唇音の後は「u」', labelInterlinear: 'ハングルと併記', labelSep: '字母区切り文字',
      ttlInterlinear: 'ハングルと並べて見る', hintInterlinear: '例文をクリックすると分かち書きを「タブ」にしてコピー', ttlRef: 'イェール式参照', ttlHist: '変換履歴',
      clearHist: 'すべて削除', closeRef: '閉じる', closeHist: '閉じる', sepPlaceholder: '∅', langToggle: '한국어', copied: 'コピー完了!',
      emptyHist: '変換履歴がありません。', refNote: '「ㅇ」は初声で省略',
      labelInputY2H: '入力（Yale式ローマ字）', labelOutputY2H: '変換結果（ハングル）',
      placeholderH2Y: '입력 대기 중', placeholderY2H: '입력 대기 중',
      hintY2H: '💡 例文にある「.」や「-」をそのまま入力しても問題ありません（例: al-keyss-ta）。',
      appSub: '退屈なことは機械にやらせよう'
    },
    ko: {
      openHist: '변환 기록', openRef: '예일식 참조', copyBtn: '변환 결과 복사',
      labelInput: '입력(한글)', labelOutput: '변환 결과', labelLabial: '양순음 뒤는 u', labelInterlinear: '한글과 나란히 보기', labelSep: '자모 구분자',
      ttlInterlinear: '한글과 나란히 보기', hintInterlinear: '예문을 클릭하면 띄어쓰기를 탭으로 하여 복사', ttlRef: '예일식 참조', ttlHist: '변환 기록',
      clearHist: '모두 지우기', closeRef: '닫기', closeHist: '닫기', sepPlaceholder: '∅', langToggle: '日本語', copied: '복사 완료!',
      emptyHist: '변환 기록이 없습니다.', refNote: '「ㅇ」은 초성에서 생략',
      labelInputY2H: '입력(예일식 로마자)', labelOutputY2H: '변환 결과(한글)',
      placeholderH2Y: '입력 대기 중', placeholderY2H: '입력 대기 중',
      hintY2H: '💡 예문에 있는 "."이나 "-"를 그대로 입력해도 문제 없습니다 (예: al-keyss-ta).',
      appSub: '지루한 건 기계에게 맡기자'
    }
  };

  function applyLang(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    const T = I18N[lang] || I18N.ja;
    $openHist.textContent = T.openHist;
    $openRef.textContent = T.openRef;
    $copy.textContent = T.copyBtn;
    // 방향에 따라 라벨 변경
    if (conversionDir === 'y2h') {
      $labelInput.textContent = T.labelInputY2H;
      $labelOutput.textContent = T.labelOutputY2H;
      $in.setAttribute('placeholder', T.placeholderY2H);
    } else {
      $labelInput.textContent = T.labelInput;
      $labelOutput.textContent = T.labelOutput;
      $in.setAttribute('placeholder', T.placeholderH2Y);
    }
    $labelLabial.textContent = T.labelLabial;
    $labelInterlinear.textContent = T.labelInterlinear;
    $labelSep.textContent = T.labelSep;
    $ttlInterlinear.textContent = T.ttlInterlinear;
    $hintInterlinear.textContent = T.hintInterlinear;
    // Y2H 모드 시 힌트 텍스트도 언어 전환
    if ($hintY2H && conversionDir === 'y2h') {
      $hintY2H.textContent = T.hintY2H || '';
    }
    $ttlRef.textContent = T.ttlRef;
    $ttlHist.textContent = T.ttlHist;
    $clearHist.textContent = T.clearHist;
    $closeRef.textContent = T.closeRef;
    $closeHist.textContent = T.closeHist;
    $sep.setAttribute('placeholder', T.sepPlaceholder);
    if ($langToggle) $langToggle.textContent = T.langToggle + (lang === 'ja' ? ' 🇰🇷' : ' 🇯🇵');
    COPIED_TEXT = T.copied;
  }

  (function initLang(){
    const KEY = 'yaleLangV1';
    const saved = localStorage.getItem(KEY) || 'ja';
    applyLang(saved);
    $langToggle?.addEventListener('click', () => {
      const next = (localStorage.getItem(KEY) || 'ja') === 'ja' ? 'ko' : 'ja';
      localStorage.setItem(KEY, next);
      applyLang(next);
    });
  })();

  // ===== 초기 =====
  $in.value = '';
  updateAll();
})();
