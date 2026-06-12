// 글로스 3행 출력 포맷터 (순수 함수) — 설계 문서 §2.3
// 글로스가 없는 모든 경로는 format.js에 위임(delegation)해 바이트 동일을 구조적으로 보장한다.
// 2행 출력 로직을 재구현하지 않는다 — format.js는 import만 (불가침).
import { formatOutput, formatSingleExample } from '../converter/format.js';

// examples에 글로스 부착: lines[i]가 glosses의 키면 examples[i]에 gloss 배열 부착.
// 배열 길이는 토큰 수로 패딩/절단 (빈 셀 = ''). 키 미스매치 줄은 원본 그대로(무부착).
export function attachGlosses(examples, lines, glosses) {
  return examples.map((ex, i) => {
    const raw = glosses.get(lines[i]);
    if (!raw) return ex;
    const gloss = ex.tokens.map((_, j) => raw[j] ?? '');
    return { ...ex, gloss };
  });
}

// 예문 단위 글로스 유무 판정 — 전부 공백이면 글로스 없음으로 취급
export function exampleHasGloss(ex) {
  return !!ex.gloss?.some((g) => g.trim() !== '');
}

export function hasAnyGloss(examples) {
  return examples.some(exampleHasGloss);
}

// gloss (TSV): 기존 2행 + 글로스 예문에만 3행째 blank + gloss.join('\t')
// 빈 셀은 '' — 탭 구분자가 자리를 보존. 예문 사이 빈 줄 유지.
function glossedTSV(examples, numbered) {
  const out = [];
  examples.forEach((ex, i) => {
    const num = numbered ? `(${i + 1})\t` : '';
    const blank = numbered ? '\t' : '';
    out.push(num + ex.tokens.join('\t'));
    out.push(blank + ex.romas.join('\t'));
    if (exampleHasGloss(ex)) out.push(blank + ex.gloss.join('\t'));
    if (i < examples.length - 1) out.push('');
  });
  return out.join('\n');
}

// LaTeX (gb4e): 글로스 예문은 \glll + 6칸 들여쓰기, 빈 셀은 {} (공백 구분 청크 수 정렬 보존).
// 글로스 없는 예문은 기존 \gll + 5칸 그대로. numbered 무시 (gb4e 자체 번호).
function glossedLatex(examples) {
  if (!examples.length) return '';
  const lines = ['\\begin{exe}'];
  for (const ex of examples) {
    lines.push('\\ex');
    if (exampleHasGloss(ex)) {
      lines.push(`\\glll ${ex.tokens.join(' ')} \\\\`);
      lines.push(`      ${ex.romas.join(' ')} \\\\`);
      // 빈 셀은 '{}', 공백 포함 셀(다단어 글로스)은 '{...}'로 감싸 \glll 청크 수를 보존
      lines.push(`      ${ex.gloss.map((g) => {
        const cell = g.trim();
        if (cell === '') return '{}';
        return /\s/.test(cell) ? `{${cell}}` : cell;
      }).join(' ')} \\\\`);
    } else {
      lines.push(`\\gll ${ex.tokens.join(' ')} \\\\`);
      lines.push(`     ${ex.romas.join(' ')} \\\\`);
    }
    lines.push("\\trans `'");
  }
  lines.push('\\end{exe}');
  return lines.join('\n');
}

// Markdown: 글로스 예문의 표에만 4행째 글로스 행 (빈 셀 '' → '|  |', 파이프가 자리 보존)
function glossedMarkdown(examples, numbered) {
  const out = [];
  examples.forEach((ex, i) => {
    if (numbered) out.push(`(${i + 1})`);
    out.push('| ' + ex.tokens.join(' | ') + ' |');
    out.push('|' + ex.tokens.map(() => '---').join('|') + '|');
    out.push('| ' + ex.romas.join(' | ') + ' |');
    if (exampleHasGloss(ex)) out.push('| ' + ex.gloss.join(' | ') + ' |');
    if (i < examples.length - 1) out.push('');
  });
  return out.join('\n');
}

// Plain: 예문당 3행 블록 ((num )원문 / 로마자 / 글로스), 블록 사이 빈 줄 1개.
// 번호는 블록 첫 행(원문 행) 선두 — 가운데 행에 붙으면 3행 블록에서 어색하다.
// 글로스 없는 예문도 같은 블록 구조(원문+로마자 2행)로 통일. plain은 비정렬 형식 — 빈 셀은 이중 공백.
function glossedPlain(examples, numbered) {
  const out = [];
  examples.forEach((ex, i) => {
    const num = numbered ? `(${i + 1}) ` : '';
    out.push(num + ex.tokens.join(' '));
    out.push(ex.romas.join(' '));
    if (exampleHasGloss(ex)) out.push(ex.gloss.join(' '));
    if (i < examples.length - 1) out.push('');
  });
  return out.join('\n');
}

// 전체 출력. 글로스가 하나도 없으면 formatOutput에 위임 ★바이트 동일
export function formatGlossedOutput(examples, format, { numbered = false } = {}) {
  if (!hasAnyGloss(examples)) return formatOutput(examples, format, { numbered });
  switch (format) {
    case 'gloss': return glossedTSV(examples, numbered);
    case 'latex': return glossedLatex(examples);
    case 'markdown': return glossedMarkdown(examples, numbered);
    default: return glossedPlain(examples, numbered);
  }
}

// 단일 예문(카드 복사). gloss가 없거나 전부 공백이면 formatSingleExample에 위임 ★바이트 동일
export function formatSingleGlossedExample(tokens, romas, gloss, format, { numbered = false, exampleIndex = 0 } = {}) {
  if (!gloss || !gloss.some((g) => g.trim() !== '')) {
    return formatSingleExample(tokens, romas, format, { numbered, exampleIndex });
  }
  const examples = [{ tokens, romas, gloss }];
  switch (format) {
    case 'latex': return glossedLatex(examples);
    case 'markdown': return glossedMarkdown(examples, numbered);
    case 'gloss': {
      const num = numbered ? `(${exampleIndex + 1})\t` : '';
      const blank = numbered ? '\t' : '';
      return num + tokens.join('\t') + '\n' + blank + romas.join('\t') + '\n' + blank + gloss.join('\t');
    }
    case 'plain':
    default: {
      const num = numbered ? `(${exampleIndex + 1}) ` : '';
      return num + tokens.join(' ') + '\n' + romas.join(' ') + '\n' + gloss.join(' ');
    }
  }
}
