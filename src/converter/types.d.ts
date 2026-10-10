// 변환 엔진(JS 모듈) 타입 경계 선언 — 원본 .js 수정 금지 (설계 문서 §0)

declare module '*/converter/h2y.js' {
  export function convert(text: string, opts?: { labial?: boolean; sep?: string }): string;
}

declare module '*/converter/y2h.js' {
  // keepHyphens: 어절 내부 '-'(형태소 경계)를 한글 출력에 남김 (기본 false)
  type Y2HOpts = { labial?: boolean; keepHyphens?: boolean };
  export function reverseConvert(text: string, opts?: Y2HOpts): string;
  export function parseYaleWordCandidates(
    word: string,
    opts?: Y2HOpts,
    k?: number,
  ): Array<{ hangul: string; score: number }>;
  export function setFrequencyData(d: {
    syllable?: object | null;
    bigram?: object | null;
    word?: object | null;
  }): void;
}

declare module '*/converter/format.js' {
  import type { Example, OutputFormat } from '../lib/types';
  export function formatPlain(examples: Example[], o?: { numbered?: boolean }): string;
  export function formatLeipzigTSV(examples: Example[], o?: { numbered?: boolean }): string;
  export function formatLatex(examples: Example[]): string;
  export function formatMarkdown(examples: Example[], o?: { numbered?: boolean }): string;
  export function formatSingleExample(
    tokens: string[],
    romas: string[],
    format: OutputFormat,
    o?: { numbered?: boolean; exampleIndex?: number },
  ): string;
}

declare module '*/converter/hangul.js' {
  export const CHOSEONG: string[];
  export const JUNGSEONG: string[];
  export const JONGSEONG: string[]; // [0]은 '' (빈 종성) — 참조표에서 filter(Boolean)
  export const J2Y: Record<string, string>;
  export const DOUBLE_CODA_SPLIT: Record<string, string>; // 'ㄳ' → 'ㄱㅅ' 식
}
