// LaTeX·Markdown 출력의 특수문자 이스케이프 (2026-11-12)
// 언어학 예문에는 판단 기호 #·%가 흔한데, LaTeX에서 %는 그 뒤(줄 끝의 \\ 포함)를 주석으로 만들고
// #·&는 컴파일 오류를 낸다. Markdown 표에서는 | 가 셀을 나눈다
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatLatex, formatMarkdown, formatPlain, formatSingleExample } from '../src/converter/format.js';
import { formatGlossedOutput, formatSingleGlossedExample } from '../src/lib/gloss-format.js';
import { buildFormattedOutput } from '../src/lib/convert-pipeline.ts';

const ex = [{ tokens: ['#철수가', '100%', 'A&B'], romas: ['#chelswuka', '100%', 'A&B'] }];

describe('LaTeX: % # & 이스케이프', () => {
  test('원문·변환 두 줄 모두', () => {
    assert.equal(formatLatex(ex),
      '\\begin{exe}\n' +
      '\\ex\n' +
      '\\gll \\#철수가 100\\% A\\&B \\\\\n' +
      '     \\#chelswuka 100\\% A\\&B \\\\\n' +
      "\\trans `'\n" +
      '\\end{exe}'
    );
  });

  test('이미 \\ 가 붙어 있으면 그대로', () => {
    const out = formatLatex([{ tokens: ['100\\%', 'A\\&B'], romas: ['100\\%', 'A\\&B'] }]);
    assert.ok(out.includes('\\gll 100\\% A\\&B \\\\'));
    assert.ok(!out.includes('\\\\%'));
  });

  test('_ ^ $ \\ { } ~ 는 그대로 (gb4e 지표·명령을 일부러 쓰는 경우)', () => {
    const tokens = ['John_i', 'x^2', '$\\emptyset$', '\\textbf{철수}', '1~2'];
    const out = formatLatex([{ tokens, romas: tokens }]);
    assert.ok(out.includes('\\gll ' + tokens.join(' ') + ' \\\\'));
  });

  test('글로스 행도 같은 규칙 — 빈 셀 {}·다단어 {...}·명령은 그대로', () => {
    const glossed = [{
      tokens: ['#철수가', '갔다', '응'],
      romas: ['#chelswuka', 'kassta', 'ung'],
      gloss: ['C&NOM', '\\textsc{pst} 100%', ''],
    }];
    assert.equal(formatGlossedOutput(glossed, 'latex'),
      '\\begin{exe}\n' +
      '\\ex\n' +
      '\\glll \\#철수가 갔다 응 \\\\\n' +
      '      \\#chelswuka kassta ung \\\\\n' +
      '      C\\&NOM {\\textsc{pst} 100\\%} {} \\\\\n' +
      "\\trans `'\n" +
      '\\end{exe}'
    );
  });

  test('카드 복사(단일 예문)도 같다', () => {
    assert.ok(formatSingleExample(ex[0].tokens, ex[0].romas, 'latex').includes('100\\% A\\&B'));
    assert.ok(formatSingleGlossedExample(ex[0].tokens, ex[0].romas, ['a', 'b&c', ''], 'latex').includes('a b\\&c {}'));
  });

  test('출력 파이프라인을 거쳐도 같다', () => {
    const out = buildFormattedOutput('100% 확실한 A&B', { sep: '', labial: true }, 'latex', false, 'h2y', new Map(), {
      enabled: false,
      map: new Map(),
    });
    assert.ok(out.includes('\\gll 100\\% 확실한 A\\&B \\\\'));
    assert.ok(out.includes('     100\\% hwaksilhan A\\&B \\\\'));
  });
});

describe('Markdown 표: | 이스케이프', () => {
  const pipe = [{ tokens: ['가|나', '다'], romas: ['ka|na', 'ta'] }];

  test('원문·변환 두 줄 모두', () => {
    assert.equal(formatMarkdown(pipe),
      '| 가\\|나 | 다 |\n' +
      '|---|---|\n' +
      '| ka\\|na | ta |'
    );
  });

  test('이미 \\| 이면 그대로', () => {
    assert.ok(formatMarkdown([{ tokens: ['a\\|b'], romas: ['a\\|b'] }]).startsWith('| a\\|b |'));
  });

  test('글로스 행도 같다', () => {
    const out = formatGlossedOutput([{ ...pipe[0], gloss: ['x|y', 'z'] }], 'markdown');
    assert.equal(out.split('\n')[3], '| x\\|y | z |');
  });
});

describe('Plain은 바꾸지 않는다', () => {
  test('% # & | 그대로', () => {
    assert.equal(formatPlain(ex), '#chelswuka 100% A&B');
    assert.equal(formatSingleExample(['가|나'], ['ka|na'], 'plain'), '가|나\nka|na');
  });
});
