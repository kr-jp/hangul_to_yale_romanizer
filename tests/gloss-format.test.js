import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  attachGlosses, exampleHasGloss, hasAnyGloss,
  formatGlossedOutput, formatSingleGlossedExample,
} from '../src/lib/gloss-format.js';
import { formatOutput, formatSingleExample } from '../src/converter/format.js';

const FORMATS = ['plain', 'gloss', 'latex', 'markdown'];

// 글로스 없는 예문 (format.test.js의 sample과 동일 구조)
const single = [
  { tokens: ['한국어를', '공부', '한다'], romas: ['hankwukelul', 'kongpu', 'hanta'] },
];
const multi = [
  { tokens: ['한국어를', '공부', '한다'], romas: ['hankwukelul', 'kongpu', 'hanta'] },
  { tokens: ['안녕하세요'], romas: ['annyenghaseyyo'] },
];

// 글로스 있는 예문
const glossed = [
  { tokens: ['한국어를', '공부', '한다'], romas: ['hankwukelul', 'kongpu', 'hanta'], gloss: ['Korean-ACC', 'study', 'do-DECL'] },
  { tokens: ['안녕하세요'], romas: ['annyenghaseyyo'], gloss: ['hello'] },
];
// 부분 글로스 (가운데 어절만 빈 셀)
const partial = [
  { tokens: ['한국어를', '공부', '한다'], romas: ['hankwukelul', 'kongpu', 'hanta'], gloss: ['Korean-ACC', '', 'do-DECL'] },
];
// 혼재: 첫 예문만 글로스, 둘째는 글로스 없음
const mixed = [
  glossed[0],
  { tokens: ['안녕하세요'], romas: ['annyenghaseyyo'] },
];

describe('위임 바이트 동일성 — 글로스 부재 시 formatOutput과 === (절대 조건)', () => {
  for (const format of FORMATS) {
    for (const numbered of [false, true]) {
      for (const [label, examples] of [['단일', single], ['복수', multi]]) {
        test(`${format} / numbered=${numbered} / ${label} 예문`, () => {
          assert.strictEqual(
            formatGlossedOutput(examples, format, { numbered }),
            formatOutput(examples, format, { numbered }),
          );
        });
      }
    }
  }
});

describe('위임 바이트 동일성 — 전부 공백 글로스는 부재와 동일 취급', () => {
  const blankGlossed = [
    { tokens: ['한국어를', '공부', '한다'], romas: ['hankwukelul', 'kongpu', 'hanta'], gloss: ['', ' ', ''] },
    { tokens: ['안녕하세요'], romas: ['annyenghaseyyo'], gloss: [''] },
  ];
  for (const format of FORMATS) {
    for (const numbered of [false, true]) {
      test(`${format} / numbered=${numbered}`, () => {
        assert.strictEqual(
          formatGlossedOutput(blankGlossed, format, { numbered }),
          formatOutput(multi, format, { numbered }),
        );
      });
    }
  }
});

describe('formatSingleGlossedExample — 글로스 부재/전부 공백 시 formatSingleExample과 ===', () => {
  const tokens = ['한국어를', '공부'];
  const romas = ['hankwukelul', 'kongpu'];
  for (const format of FORMATS) {
    for (const numbered of [false, true]) {
      for (const [label, gloss] of [['undefined', undefined], ['전부 공백', ['', ' ']]]) {
        test(`${format} / numbered=${numbered} / gloss=${label}`, () => {
          assert.strictEqual(
            formatSingleGlossedExample(tokens, romas, gloss, format, { numbered, exampleIndex: 1 }),
            formatSingleExample(tokens, romas, format, { numbered, exampleIndex: 1 }),
          );
        });
      }
    }
  }
});

describe('formatGlossedOutput — gloss (TSV) 3행', () => {
  test('번호 OFF: 글로스 예문은 3행, 예문 사이 빈 줄', () => {
    assert.equal(formatGlossedOutput(glossed, 'gloss'),
      '한국어를\t공부\t한다\n' +
      'hankwukelul\tkongpu\thanta\n' +
      'Korean-ACC\tstudy\tdo-DECL\n' +
      '\n' +
      '안녕하세요\n' +
      'annyenghaseyyo\n' +
      'hello'
    );
  });

  test('번호 ON: (1) 첫 컬럼, 2·3행은 빈 탭으로 정렬', () => {
    assert.equal(formatGlossedOutput(glossed, 'gloss', { numbered: true }),
      '(1)\t한국어를\t공부\t한다\n' +
      '\thankwukelul\tkongpu\thanta\n' +
      '\tKorean-ACC\tstudy\tdo-DECL\n' +
      '\n' +
      '(2)\t안녕하세요\n' +
      '\tannyenghaseyyo\n' +
      '\thello'
    );
  });

  test('부분 글로스: 빈 셀의 탭 자리 보존', () => {
    assert.equal(formatGlossedOutput(partial, 'gloss'),
      '한국어를\t공부\t한다\n' +
      'hankwukelul\tkongpu\thanta\n' +
      'Korean-ACC\t\tdo-DECL'
    );
  });

  test('혼재: 글로스 없는 예문은 그 예문만 기존 2행', () => {
    assert.equal(formatGlossedOutput(mixed, 'gloss'),
      '한국어를\t공부\t한다\n' +
      'hankwukelul\tkongpu\thanta\n' +
      'Korean-ACC\tstudy\tdo-DECL\n' +
      '\n' +
      '안녕하세요\n' +
      'annyenghaseyyo'
    );
  });
});

describe('formatGlossedOutput — LaTeX (gb4e)', () => {
  test('글로스 예문은 \\glll + 6칸 들여쓰기 3행', () => {
    assert.equal(formatGlossedOutput(glossed, 'latex'),
      '\\begin{exe}\n' +
      '\\ex\n' +
      '\\glll 한국어를 공부 한다 \\\\\n' +
      '      hankwukelul kongpu hanta \\\\\n' +
      '      Korean-ACC study do-DECL \\\\\n' +
      "\\trans `'\n" +
      '\\ex\n' +
      '\\glll 안녕하세요 \\\\\n' +
      '      annyenghaseyyo \\\\\n' +
      '      hello \\\\\n' +
      "\\trans `'\n" +
      '\\end{exe}'
    );
  });

  test('부분 글로스: 빈 셀은 {} (열 정렬 보존)', () => {
    assert.equal(formatGlossedOutput(partial, 'latex'),
      '\\begin{exe}\n' +
      '\\ex\n' +
      '\\glll 한국어를 공부 한다 \\\\\n' +
      '      hankwukelul kongpu hanta \\\\\n' +
      '      Korean-ACC {} do-DECL \\\\\n' +
      "\\trans `'\n" +
      '\\end{exe}'
    );
  });

  test('다단어 글로스 셀은 {...}로 감싸 \\glll 청크 수 보존 (2026-06-12 수정)', () => {
    const multiWord = [
      { tokens: ['한국어를', '했다'], romas: ['hankwukelul', 'hayssta'], gloss: ['Korean-ACC', 'do PST'] },
    ];
    assert.equal(formatGlossedOutput(multiWord, 'latex'),
      '\\begin{exe}\n' +
      '\\ex\n' +
      '\\glll 한국어를 했다 \\\\\n' +
      '      hankwukelul hayssta \\\\\n' +
      '      Korean-ACC {do PST} \\\\\n' +
      "\\trans `'\n" +
      '\\end{exe}'
    );
  });

  test('혼재: \\glll/\\gll 공존, 글로스 없는 예문은 기존 \\gll + 5칸', () => {
    assert.equal(formatGlossedOutput(mixed, 'latex'),
      '\\begin{exe}\n' +
      '\\ex\n' +
      '\\glll 한국어를 공부 한다 \\\\\n' +
      '      hankwukelul kongpu hanta \\\\\n' +
      '      Korean-ACC study do-DECL \\\\\n' +
      "\\trans `'\n" +
      '\\ex\n' +
      '\\gll 안녕하세요 \\\\\n' +
      '     annyenghaseyyo \\\\\n' +
      "\\trans `'\n" +
      '\\end{exe}'
    );
  });

  test('numbered 무시 (gb4e 자체 번호 — 현행 LaTeX과 동일)', () => {
    assert.equal(
      formatGlossedOutput(glossed, 'latex', { numbered: true }),
      formatGlossedOutput(glossed, 'latex')
    );
  });
});

describe('formatGlossedOutput — Markdown 표 4행째', () => {
  test('글로스 예문의 표에 4행째 글로스 행', () => {
    assert.equal(formatGlossedOutput(glossed, 'markdown'),
      '| 한국어를 | 공부 | 한다 |\n' +
      '|---|---|---|\n' +
      '| hankwukelul | kongpu | hanta |\n' +
      '| Korean-ACC | study | do-DECL |\n' +
      '\n' +
      '| 안녕하세요 |\n' +
      '|---|\n' +
      '| annyenghaseyyo |\n' +
      '| hello |'
    );
  });

  test('부분 글로스: 빈 셀 파이프 보존 (|  |)', () => {
    assert.equal(formatGlossedOutput(partial, 'markdown'),
      '| 한국어를 | 공부 | 한다 |\n' +
      '|---|---|---|\n' +
      '| hankwukelul | kongpu | hanta |\n' +
      '| Korean-ACC |  | do-DECL |'
    );
  });

  test('혼재: 글로스 없는 예문은 기존 3행 표', () => {
    assert.equal(formatGlossedOutput(mixed, 'markdown'),
      '| 한국어를 | 공부 | 한다 |\n' +
      '|---|---|---|\n' +
      '| hankwukelul | kongpu | hanta |\n' +
      '| Korean-ACC | study | do-DECL |\n' +
      '\n' +
      '| 안녕하세요 |\n' +
      '|---|\n' +
      '| annyenghaseyyo |'
    );
  });

  test('번호 ON: (1)(2)... 표 위에 표시', () => {
    const out = formatGlossedOutput(glossed, 'markdown', { numbered: true });
    assert.match(out, /^\(1\)\n\| 한국어를/);
    assert.match(out, /\(2\)\n\| 안녕하세요/);
  });
});

describe('formatGlossedOutput — Plain 3행 블록', () => {
  test('예문당 3행 블록 (원문/로마자/글로스), 블록 사이 빈 줄 1개', () => {
    assert.equal(formatGlossedOutput(glossed, 'plain'),
      '한국어를 공부 한다\n' +
      'hankwukelul kongpu hanta\n' +
      'Korean-ACC study do-DECL\n' +
      '\n' +
      '안녕하세요\n' +
      'annyenghaseyyo\n' +
      'hello'
    );
  });

  test('numbered 접두는 블록 첫 행(원문 행) 선두', () => {
    assert.equal(formatGlossedOutput(glossed, 'plain', { numbered: true }),
      '(1) 한국어를 공부 한다\n' +
      'hankwukelul kongpu hanta\n' +
      'Korean-ACC study do-DECL\n' +
      '\n' +
      '(2) 안녕하세요\n' +
      'annyenghaseyyo\n' +
      'hello'
    );
  });

  test('numbered + 혼재: 글로스 없는 블록도 번호는 첫 행 (블록 구조 통일)', () => {
    assert.equal(formatGlossedOutput(mixed, 'plain', { numbered: true }),
      '(1) 한국어를 공부 한다\n' +
      'hankwukelul kongpu hanta\n' +
      'Korean-ACC study do-DECL\n' +
      '\n' +
      '(2) 안녕하세요\n' +
      'annyenghaseyyo'
    );
  });

  test('혼재: 글로스 없는 예문도 같은 블록 구조 (원문+로마자 2행)', () => {
    assert.equal(formatGlossedOutput(mixed, 'plain'),
      '한국어를 공부 한다\n' +
      'hankwukelul kongpu hanta\n' +
      'Korean-ACC study do-DECL\n' +
      '\n' +
      '안녕하세요\n' +
      'annyenghaseyyo'
    );
  });

  test('부분 글로스: 빈 셀은 이중 공백 (plain은 비정렬 형식)', () => {
    assert.equal(formatGlossedOutput(partial, 'plain'),
      '한국어를 공부 한다\n' +
      'hankwukelul kongpu hanta\n' +
      'Korean-ACC  do-DECL'
    );
  });

  test('알 수 없는 형식은 plain 글로스 블록으로 폴백 (formatOutput 선례)', () => {
    assert.equal(
      formatGlossedOutput(partial, 'unknown'),
      formatGlossedOutput(partial, 'plain')
    );
  });
});

describe('formatGlossedOutput — 엣지: 빈 examples', () => {
  for (const format of FORMATS) {
    test(`${format}: 빈 배열 → ''`, () => {
      assert.strictEqual(formatGlossedOutput([], format), '');
      assert.strictEqual(formatGlossedOutput([], format, { numbered: true }), '');
    });
  }
});

describe('attachGlosses', () => {
  const examples = [
    { tokens: ['한국어를', '공부', '한다'], romas: ['hankwukelul', 'kongpu', 'hanta'] },
    { tokens: ['안녕하세요'], romas: ['annyenghaseyyo'] },
  ];
  const lines = ['한국어를 공부 한다', '안녕하세요'];

  test('키 일치 줄만 부착, 미일치 줄은 무부착', () => {
    const map = new Map([['한국어를 공부 한다', ['Korean-ACC', 'study', 'do-DECL']]]);
    const out = attachGlosses(examples, lines, map);
    assert.deepEqual(out[0].gloss, ['Korean-ACC', 'study', 'do-DECL']);
    assert.equal(out[1].gloss, undefined);
  });

  test('토큰 수보다 짧으면 빈 셀로 패딩', () => {
    const map = new Map([['한국어를 공부 한다', ['Korean-ACC']]]);
    const out = attachGlosses(examples, lines, map);
    assert.deepEqual(out[0].gloss, ['Korean-ACC', '', '']);
  });

  test('토큰 수보다 길면 절단', () => {
    const map = new Map([['안녕하세요', ['hello', 'extra', 'extra2']]]);
    const out = attachGlosses(examples, lines, map);
    assert.deepEqual(out[1].gloss, ['hello']);
  });

  test('동일 텍스트 줄 2개는 글로스 공유', () => {
    const dup = [
      { tokens: ['안녕하세요'], romas: ['annyenghaseyyo'] },
      { tokens: ['안녕하세요'], romas: ['annyenghaseyyo'] },
    ];
    const map = new Map([['안녕하세요', ['hello']]]);
    const out = attachGlosses(dup, ['안녕하세요', '안녕하세요'], map);
    assert.deepEqual(out[0].gloss, ['hello']);
    assert.deepEqual(out[1].gloss, ['hello']);
  });

  test('키 전부 미스매치면 어느 예문에도 무부착 → hasAnyGloss false', () => {
    const map = new Map([['수정된 다른 줄', ['x']]]);
    const out = attachGlosses(examples, lines, map);
    assert.equal(hasAnyGloss(out), false);
  });

  test('lines가 examples보다 짧아도 (어절/줄 수 불일치) 초과분은 무부착', () => {
    const map = new Map([['한국어를 공부 한다', ['Korean-ACC', 'study', 'do-DECL']]]);
    const out = attachGlosses(examples, ['한국어를 공부 한다'], map);
    assert.deepEqual(out[0].gloss, ['Korean-ACC', 'study', 'do-DECL']);
    assert.equal(out[1].gloss, undefined);
  });

  test('원본 examples를 변형하지 않음 (새 객체 반환)', () => {
    const map = new Map([['한국어를 공부 한다', ['Korean-ACC', 'study', 'do-DECL']]]);
    attachGlosses(examples, lines, map);
    assert.equal(examples[0].gloss, undefined);
  });

  test('빈 Map이면 전부 무부착', () => {
    const out = attachGlosses(examples, lines, new Map());
    assert.equal(hasAnyGloss(out), false);
  });
});

describe('exampleHasGloss / hasAnyGloss', () => {
  test('gloss 미부착 → false', () => {
    assert.equal(exampleHasGloss({ tokens: ['a'], romas: ['a'] }), false);
  });

  test('전부 공백(빈 문자열·공백 문자) → false', () => {
    assert.equal(exampleHasGloss({ tokens: ['a', 'b'], romas: ['a', 'b'], gloss: ['', '  '] }), false);
  });

  test('한 셀이라도 내용이 있으면 true', () => {
    assert.equal(exampleHasGloss({ tokens: ['a', 'b'], romas: ['a', 'b'], gloss: ['', 'NOM'] }), true);
  });

  test('hasAnyGloss: 빈 배열 → false, 혼재 → true', () => {
    assert.equal(hasAnyGloss([]), false);
    assert.equal(hasAnyGloss(mixed), true);
    assert.equal(hasAnyGloss(multi), false);
  });
});

describe('formatSingleGlossedExample — 글로스 존재 시', () => {
  const tokens = ['한국어'];
  const romas = ['hankwuke'];
  const gloss = ['Korean'];

  test('plain: 3행', () => {
    assert.equal(
      formatSingleGlossedExample(tokens, romas, gloss, 'plain'),
      '한국어\nhankwuke\nKorean'
    );
  });

  test('plain with number: numbered 접두는 블록 첫 행(원문 행) — 카드 복사도 동일', () => {
    assert.equal(
      formatSingleGlossedExample(tokens, romas, gloss, 'plain', { numbered: true, exampleIndex: 1 }),
      '(2) 한국어\nhankwuke\nKorean'
    );
  });

  test('gloss with number: exampleIndex 반영 + 빈 탭 정렬 3행', () => {
    assert.equal(
      formatSingleGlossedExample(tokens, romas, gloss, 'gloss', { numbered: true, exampleIndex: 2 }),
      '(3)\t한국어\n\thankwuke\n\tKorean'
    );
  });

  test('gloss without number: 부분 글로스의 탭 자리 보존', () => {
    assert.equal(
      formatSingleGlossedExample(['한국어를', '공부'], ['hankwukelul', 'kongpu'], ['Korean-ACC', ''], 'gloss'),
      '한국어를\t공부\nhankwukelul\tkongpu\nKorean-ACC\t'
    );
  });

  test('latex: \\begin{exe} 환경 + \\glll + 빈 셀 {}', () => {
    assert.equal(
      formatSingleGlossedExample(['한국어를', '공부'], ['hankwukelul', 'kongpu'], ['Korean-ACC', ''], 'latex'),
      '\\begin{exe}\n' +
      '\\ex\n' +
      '\\glll 한국어를 공부 \\\\\n' +
      '      hankwukelul kongpu \\\\\n' +
      '      Korean-ACC {} \\\\\n' +
      "\\trans `'\n" +
      '\\end{exe}'
    );
  });

  test('markdown 단일: 4행 표', () => {
    assert.equal(
      formatSingleGlossedExample(tokens, romas, gloss, 'markdown'),
      '| 한국어 |\n|---|\n| hankwuke |\n| Korean |'
    );
  });
});
