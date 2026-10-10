// 출력 생성 파이프라인 — src/ui/dom.js 88–150행의 순수 로직 이식 (설계 문서 §4.1)
import { convert } from '../converter/h2y.js';
import { parseYaleWordCandidates } from '../converter/y2h.js';
import { formatPlain, formatLeipzigTSV, formatLatex, formatMarkdown } from '../converter/format.js';
import { attachGlosses, formatGlossedOutput, hasAnyGloss } from './gloss-format.js';
import type { ConvertOpts, Direction, Example, OutputFormat, YaleCandidate } from './types';

// 유효 sep = sepEnabled ? sepChar.slice(0,1) : ''. keepHyphens는 y2h 전용 (h2y 변환은 무시)
export function getOpts(state: {
  sepEnabled: boolean;
  sepChar: string;
  labial: boolean;
  keepHyphens?: boolean;
}): ConvertOpts {
  const sep = state.sepEnabled ? (state.sepChar || '').slice(0, 1) : '';
  const labial = !!state.labial;
  return { sep, labial, keepHyphens: !!state.keepHyphens };
}

// 분해형(NFD) 한글은 완성형으로 합쳐 둔다 — 줄 텍스트가 글로스 키·표시 토큰으로도 쓰이므로
export function splitLines(text: string): string[] {
  return (text || '').normalize('NFC').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

// 후보 목록과 사용자 override를 비교해 표시할 hangul 결정
// override가 후보 목록에 '여전히 존재'할 때만 적용, 아니면 best 후보
export function pickPreferred(
  yaleWord: string,
  candidates: YaleCandidate[],
  overrides: ReadonlyMap<string, string>,
): string {
  const override = overrides.get(yaleWord);
  if (override && candidates.some((c) => c.hangul === override)) return override;
  return candidates[0]?.hangul || '';
}

// 토큰 단위 변환 결과를 [{tokens, romas}, ...]로 직조
// y2h: word별 후보 + override 적용. h2y: 결정론적
export function buildExamples(
  text: string,
  opts: ConvertOpts,
  direction: Direction,
  overrides: ReadonlyMap<string, string>,
): Example[] {
  const out: Example[] = [];
  for (const line of splitLines(text)) {
    const tokens = line.split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    let romas: string[];
    if (direction === 'y2h') {
      romas = tokens.map((tk) => pickPreferred(tk, parseYaleWordCandidates(tk, opts, 5), overrides));
    } else {
      romas = tokens.map((tk) => convert(tk, opts));
    }
    out.push({ tokens, romas });
  }
  return out;
}

// Plain 본문: 원문의 줄바꿈·공백은 그대로 두고 토큰만 변환. y2h는 토큰별 후보 + override 적용.
// override 유무와 관계없이 같은 경로 — 후보를 고르는 순간 빈 줄·연속 공백이 사라지던 문제 수정
function convertPlainText(
  text: string,
  opts: ConvertOpts,
  direction: Direction,
  overrides: ReadonlyMap<string, string>,
): string {
  if (direction !== 'y2h') return convert(text, opts);
  return text
    .split(/(\s+)/)
    .map((part) => (!part || /^\s/.test(part) ? part : pickPreferred(part, parseYaleWordCandidates(part, opts, 5), overrides)))
    .join('');
}

// 예문 번호: 내용이 있는 줄에만 (n)을 붙이고 빈 줄은 그대로 둔다
function numberLines(text: string): string {
  let n = 0;
  return text
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `(${++n}) ${line.trim()}` : ''))
    .join('\n');
}

// 공유·백업용 글로스 캡처 필터 (§2.5) — 현재 입력 줄에 존재하고 내용이 있는 항목만
export function collectShareGlosses(
  lines: string[],
  glosses: ReadonlyMap<string, string[]>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const line of lines) {
    // 동일 텍스트 줄 중복은 1회만 ('in'은 'toString' 같은 프로토타입 키와 오탐하므로 hasOwnProperty)
    if (Object.prototype.hasOwnProperty.call(out, line)) continue;
    const g = glosses.get(line);
    if (g && g.some((cell) => (cell || '').trim() !== '')) out[line] = g;
  }
  return out;
}

// 형식별 출력 텍스트 생성
// gloss: 글로스 3행 (Stage 5 기능 2). enabled=출력 게이트, map은 줄 텍스트(trim) 키 (§2.2)
export function buildFormattedOutput(
  text: string,
  opts: ConvertOpts,
  format: OutputFormat,
  numbered: boolean,
  direction: Direction,
  overrides: ReadonlyMap<string, string>,
  gloss: { enabled: boolean; map: ReadonlyMap<string, string[]> },
): string {
  if (!text || !text.trim()) return '';
  const src = text.normalize('NFC');
  // 글로스 분기 (§2.4) — off·빈 글로스면 아래 기존 경로가 그대로 실행됨 (바이트 동일)
  if (gloss.enabled && gloss.map.size > 0) {
    const examples = buildExamples(src, opts, direction, overrides);
    const glossed = attachGlosses(examples, splitLines(src), gloss.map);
    if (hasAnyGloss(glossed)) return formatGlossedOutput(glossed, format, { numbered });
  }
  if (format === 'plain' || !format) {
    const body = convertPlainText(src, opts, direction, overrides);
    return numbered ? numberLines(body) : body;
  }
  const examples = buildExamples(src, opts, direction, overrides);
  switch (format) {
    case 'gloss':
      return formatLeipzigTSV(examples, { numbered });
    case 'latex':
      return formatLatex(examples);
    case 'markdown':
      return formatMarkdown(examples, { numbered });
    default:
      return formatPlain(examples, { numbered });
  }
}
