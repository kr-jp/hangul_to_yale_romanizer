// 출력 형식 포맷터 (순수 함수). examples = [{tokens, romas}, ...]
// 변환 자체에는 관여하지 않음 — 호출자가 미리 변환된 examples를 넘긴다

// Plain: examples를 줄별로 변환 결과(romas)만 출력
export function formatPlain(examples, { numbered = false } = {}) {
  return examples
    .map((ex, i) => (numbered ? `(${i + 1}) ` : '') + ex.romas.join(' '))
    .join('\n');
}

// Leipzig Glossing Rules — TSV (원문 / 변환 두 행, 토큰을 탭으로 구분)
export function formatLeipzigTSV(examples, { numbered = false } = {}) {
  const out = [];
  examples.forEach((ex, i) => {
    const num = numbered ? `(${i + 1})\t` : '';
    const blank = numbered ? '\t' : '';
    out.push(num + ex.tokens.join('\t'));
    out.push(blank + ex.romas.join('\t'));
    if (i < examples.length - 1) out.push('');
  });
  return out.join('\n');
}

// LaTeX에서 줄을 깨뜨리는 글자만 이스케이프 — %는 그 뒤(줄 끝의 \\ 포함)를 주석으로 만들고 #·&는 컴파일 오류를 낸다
// (언어학 예문의 판단 기호 #·%로 흔하다). _ ^ $ \ { } ~ 는 gb4e 지표(John_i)·명령(\textsc{nom})처럼
// 일부러 쓰는 경우가 있어 그대로 둔다. 이미 \가 붙어 있으면 건드리지 않는다
export function escapeLatex(s) {
  return s.replace(/(?<!\\)[%#&]/g, '\\$&');
}

// Markdown 표에서 셀을 나누는 | 이스케이프 (이미 \| 이면 그대로)
export function escapeMarkdownCell(s) {
  return s.replace(/(?<!\\)\|/g, '\\|');
}

// LaTeX (gb4e 패키지)
export function formatLatex(examples) {
  if (!examples.length) return '';
  const lines = ['\\begin{exe}'];
  for (const ex of examples) {
    lines.push('\\ex');
    lines.push(`\\gll ${ex.tokens.map(escapeLatex).join(' ')} \\\\`);
    lines.push(`     ${ex.romas.map(escapeLatex).join(' ')} \\\\`);
    lines.push("\\trans `'");
  }
  lines.push('\\end{exe}');
  return lines.join('\n');
}

// Markdown 표 (예문별로 분리 — 토큰 수가 다른 예문을 한 표에 합치면 컬럼이 안 맞음)
export function formatMarkdown(examples, { numbered = false } = {}) {
  const out = [];
  examples.forEach((ex, i) => {
    if (numbered) out.push(`(${i + 1})`);
    out.push('| ' + ex.tokens.map(escapeMarkdownCell).join(' | ') + ' |');
    out.push('|' + ex.tokens.map(() => '---').join('|') + '|');
    out.push('| ' + ex.romas.map(escapeMarkdownCell).join(' | ') + ' |');
    if (i < examples.length - 1) out.push('');
  });
  return out.join('\n');
}

// 단일 예문(인터리니어 카드 클릭) 변환용 분기 헬퍼
export function formatSingleExample(tokens, romas, format, { numbered = false, exampleIndex = 0 } = {}) {
  const examples = [{ tokens, romas }];
  switch (format) {
    case 'latex': return formatLatex(examples);
    case 'markdown': return formatMarkdown(examples, { numbered });
    case 'gloss': {
      const num = numbered ? `(${exampleIndex + 1})\t` : '';
      const blank = numbered ? '\t' : '';
      return num + tokens.join('\t') + '\n' + blank + romas.join('\t');
    }
    case 'plain':
    default: {
      const num = numbered ? `(${exampleIndex + 1}) ` : '';
      return tokens.join(' ') + '\n' + num + romas.join(' ');
    }
  }
}

// 전체 출력 텍스트 생성. plain은 caller가 별도 처리(원문 통째 변환), 나머지는 examples 기반
export function formatOutput(examples, format, { numbered = false } = {}) {
  switch (format) {
    case 'gloss': return formatLeipzigTSV(examples, { numbered });
    case 'latex': return formatLatex(examples);
    case 'markdown': return formatMarkdown(examples, { numbered });
    default: return formatPlain(examples, { numbered });
  }
}
