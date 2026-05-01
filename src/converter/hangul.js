// 한글 자모 체계: 음절 ↔ 자모 분해/합성 헬퍼
import mappings from '../data/mappings.json' with { type: 'json' };

export const SBase = 0xAC00;
export const LBase = 0x1100;
export const VBase = 0x1161;
export const TBase = 0x11A7;
export const LCount = 19;
export const VCount = 21;
export const TCount = 28;
export const NCount = VCount * TCount;
export const SCount = LCount * NCount;

export const CHOSEONG = mappings.choseong;
export const JUNGSEONG = mappings.jungseong;
export const JONGSEONG = mappings.jongseong;
export const DOUBLE_CODA_SPLIT = mappings.doubleCodaSplit;
export const J2Y = mappings.jamoToYale;
export const BILABIALS = new Set(mappings.bilabials);

// 한글 완성형 음절 여부
export function isHangulSyllable(ch) {
  const code = ch.codePointAt(0);
  return code >= SBase && code < (SBase + SCount);
}

// 한글 → 자모(호환 자모) 분해. 초성 ㅇ은 제거(Yale 표기상 묵음)
export function toJamo(text) {
  const out = [];
  for (const ch of text) {
    if (!isHangulSyllable(ch)) { out.push(ch); continue; }
    const SIndex = ch.codePointAt(0) - SBase;
    const LIndex = Math.floor(SIndex / NCount);
    const VIndex = Math.floor((SIndex % NCount) / TCount);
    const TIndex = SIndex % TCount;

    const onset = CHOSEONG[LIndex];
    const nucleus = JUNGSEONG[VIndex];
    const coda = JONGSEONG[TIndex];

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

// 초성 + 중성 + 종성(옵션) → 완성형 한글 음절
export function composeHangul(onset, vowel, coda) {
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
