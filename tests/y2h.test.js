// Yale → 한글 역변환 테스트.
// 빈도 데이터를 주입하지 않으면 탐욕 파서로 폴백 — 모호성 없는 단어는 결정론적
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { reverseConvert, parseYaleWordGreedy } from '../src/converter/y2h.js';

describe('reverseConvert (Yale → 한글, 탐욕 폴백)', () => {
  test('빈 입력', () => {
    assert.equal(reverseConvert(''), '');
    assert.equal(reverseConvert('   '), '');
  });

  test('기본 단어 (모호성 없음)', () => {
    assert.equal(reverseConvert('hankwuk'), '한국');
    assert.equal(reverseConvert('hakkyo'), '학교');
    assert.equal(reverseConvert('annyeng'), '안녕');
  });

  test('양순음 역적용 ON (기본): pu → 부', () => {
    assert.equal(reverseConvert('pu'), '부');
    assert.equal(reverseConvert('mu'), '무');
    assert.equal(reverseConvert('phu'), '푸');
  });

  test('양순음 역적용 OFF: pu → 브 (p=ㅂ, u=ㅡ)', () => {
    assert.equal(reverseConvert('pu', { labial: false }), '브');
  });

  test('. 또는 - 로 음절 경계 명시', () => {
    assert.equal(reverseConvert('al-keyss-ta'), '알겠다');
    assert.equal(reverseConvert('al.keyss.ta'), '알겠다');
  });

  test('공백/문장부호 보존', () => {
    assert.equal(reverseConvert('hankwuk!'), '한국!');
    // 'e'는 ㅓ. 'eo'는 두 모음(ㅓ+ㅗ)이므로 두 음절로 분해됨
    assert.equal(reverseConvert('hankwuk e'), '한국 어');
  });

  test('개행 보존', () => {
    assert.equal(reverseConvert('hankwuk\nannyeng'), '한국\n안녕');
  });

  test('알파벳/구두점 외 문자는 그대로', () => {
    assert.equal(reverseConvert('hankwuk 한국'), '한국 한국');
  });
});

describe('parseYaleWordGreedy', () => {
  test('받침 결합 (자음만 세그먼트는 앞 음절 종성으로)', () => {
    // han.k.wuk: k가 자음만 세그먼트 → 한 + ㄱ → 항... 이것은 결합 동작 검증
    // 단순 케이스만 — 실제 구현 동작에 의존
    const r = parseYaleWordGreedy('hankwuk');
    assert.equal(r, '한국');
  });

  test('빈 단어', () => {
    assert.equal(parseYaleWordGreedy(''), '');
  });

  test('양순음 옵션', () => {
    assert.equal(parseYaleWordGreedy('pu', { labial: true }), '부');
    assert.equal(parseYaleWordGreedy('pu', { labial: false }), '브');
    // 진짜 '프'를 만들려면 phu (ph=ㅍ)
    assert.equal(parseYaleWordGreedy('phu', { labial: false }), '프');
  });
});

describe('라운드트립 (모호성 없는 단어)', () => {
  // 한글 → Yale → 한글이 다시 같아지는지
  // 양순음 규칙은 한쪽으로만 보존되므로 양순음 없는 단어로 한정
  const cases = ['한국', '안녕', '학교', '서울', '음식'];
  for (const word of cases) {
    test(word, async () => {
      const { convert } = await import('../src/converter/h2y.js');
      const yale = convert(word, { labial: false });
      const back = reverseConvert(yale, { labial: false });
      assert.equal(back, word, `라운드트립 실패: ${word} → ${yale} → ${back}`);
    });
  }
});
