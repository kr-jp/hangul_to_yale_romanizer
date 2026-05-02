import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPlain, formatLeipzigTSV, formatLatex, formatMarkdown,
  formatSingleExample, formatOutput,
} from '../src/converter/format.js';

const sample = [
  { tokens: ['한국어를', '공부', '한다'], romas: ['hankwukelul', 'kongpu', 'hanta'] },
  { tokens: ['안녕하세요'], romas: ['annyenghaseyyo'] },
];

describe('formatPlain', () => {
  test('번호 OFF: 변환 결과(romas)만 줄바꿈으로 결합', () => {
    assert.equal(formatPlain(sample), 'hankwukelul kongpu hanta\nannyenghaseyyo');
  });

  test('번호 ON: 각 줄 앞에 (1) (2) ...', () => {
    assert.equal(
      formatPlain(sample, { numbered: true }),
      '(1) hankwukelul kongpu hanta\n(2) annyenghaseyyo'
    );
  });

  test('빈 examples', () => {
    assert.equal(formatPlain([]), '');
    assert.equal(formatPlain([], { numbered: true }), '');
  });
});

describe('formatLeipzigTSV', () => {
  test('번호 OFF: 두 행 탭 구분, 예문 사이 빈 줄', () => {
    const out = formatLeipzigTSV(sample);
    assert.equal(out,
      '한국어를\t공부\t한다\n' +
      'hankwukelul\tkongpu\thanta\n' +
      '\n' +
      '안녕하세요\n' +
      'annyenghaseyyo'
    );
  });

  test('번호 ON: (1)(2)... 첫 컬럼, 두번째 행은 빈 탭으로 정렬', () => {
    const out = formatLeipzigTSV(sample, { numbered: true });
    assert.equal(out,
      '(1)\t한국어를\t공부\t한다\n' +
      '\thankwukelul\tkongpu\thanta\n' +
      '\n' +
      '(2)\t안녕하세요\n' +
      '\tannyenghaseyyo'
    );
  });
});

describe('formatLatex', () => {
  test('gb4e 패키지 형식', () => {
    const out = formatLatex(sample);
    assert.equal(out,
      '\\begin{exe}\n' +
      '\\ex\n' +
      '\\gll 한국어를 공부 한다 \\\\\n' +
      '     hankwukelul kongpu hanta \\\\\n' +
      "\\trans `'\n" +
      '\\ex\n' +
      '\\gll 안녕하세요 \\\\\n' +
      '     annyenghaseyyo \\\\\n' +
      "\\trans `'\n" +
      '\\end{exe}'
    );
  });

  test('빈 examples', () => {
    assert.equal(formatLatex([]), '');
  });
});

describe('formatMarkdown', () => {
  test('번호 OFF: 예문별 표 분리, 사이 빈 줄', () => {
    const out = formatMarkdown(sample);
    assert.equal(out,
      '| 한국어를 | 공부 | 한다 |\n' +
      '|---|---|---|\n' +
      '| hankwukelul | kongpu | hanta |\n' +
      '\n' +
      '| 안녕하세요 |\n' +
      '|---|\n' +
      '| annyenghaseyyo |'
    );
  });

  test('번호 ON: (1)(2)... 표 위에 표시', () => {
    const out = formatMarkdown(sample, { numbered: true });
    assert.match(out, /^\(1\)\n\| 한국어를/);
    assert.match(out, /\(2\)\n\| 안녕하세요/);
  });
});

describe('formatSingleExample', () => {
  const tokens = ['한국어'];
  const romas = ['hankwuke'];

  test('plain', () => {
    assert.equal(formatSingleExample(tokens, romas, 'plain'), '한국어\nhankwuke');
  });

  test('plain with number', () => {
    assert.equal(
      formatSingleExample(tokens, romas, 'plain', { numbered: true, exampleIndex: 1 }),
      '한국어\n(2) hankwuke'
    );
  });

  test('gloss without number', () => {
    assert.equal(formatSingleExample(tokens, romas, 'gloss'), '한국어\nhankwuke');
  });

  test('gloss with number', () => {
    assert.equal(
      formatSingleExample(tokens, romas, 'gloss', { numbered: true, exampleIndex: 2 }),
      '(3)\t한국어\n\thankwuke'
    );
  });

  test('latex 단일 예문도 \\begin{exe} 환경에 감싸짐', () => {
    const out = formatSingleExample(tokens, romas, 'latex');
    assert.match(out, /\\begin\{exe\}/);
    assert.match(out, /\\end\{exe\}/);
  });

  test('markdown 단일', () => {
    const out = formatSingleExample(tokens, romas, 'markdown');
    assert.equal(out, '| 한국어 |\n|---|\n| hankwuke |');
  });
});

describe('formatOutput 분기', () => {
  test('알 수 없는 형식은 plain으로 폴백', () => {
    assert.equal(formatOutput(sample, 'unknown'), formatPlain(sample));
  });

  test('각 형식이 올바른 함수로 위임', () => {
    assert.equal(formatOutput(sample, 'plain'), formatPlain(sample));
    assert.equal(formatOutput(sample, 'gloss'), formatLeipzigTSV(sample));
    assert.equal(formatOutput(sample, 'latex'), formatLatex(sample));
    assert.equal(formatOutput(sample, 'markdown'), formatMarkdown(sample));
  });

  test('numbered 옵션 전달', () => {
    assert.equal(
      formatOutput(sample, 'gloss', { numbered: true }),
      formatLeipzigTSV(sample, { numbered: true })
    );
  });
});
