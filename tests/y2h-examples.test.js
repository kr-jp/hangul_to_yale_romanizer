// 자작 예문 회귀 테스트 (2026-10) — 언어학 논문식 형태소 분절 예문과 분절하지 않은 문장
// 예문·한글은 이 저장소를 위해 직접 작성했다 (논문에서 옮기지 않음). 한글을 먼저 쓰고 Yale로 옮긴 뒤 하이픈으로 분절.
// - 분절 예문·이름·표기 기호: 1위 결과가 정답이어야 한다 — 「형태소 경계 '-' 표시」 ON / OFF 두 출력 모두
// - 분절하지 않은 문장: 1위 결과가 정답
// - 표기만으로는 정할 수 없는 어형(문맥이 필요한 동형어): 정답이 5후보 안에 있으면 된다
// 빈도 데이터나 엔진을 바꾸면 이 테스트로 퇴행 여부를 확인한다 (data/README.md)
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { reverseConvert, parseYaleWordCandidates, setFrequencyData } from '../src/converter/y2h.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// [Yale, 경계 표시 ON, OFF(기본)]
const SEGMENTED = [
  ['Chelswu-ka chayk-ul ilk-ess-ta.', '철수-가 책-을 읽-었-다.', '철수가 책을 읽었다.'],
  ['Yenghuy-nun hakkyo-ey ka-ss-ta.', '영희-는 학교-에 가-ㅆ-다.', '영희는 학교에 갔다.'],
  ['sensayngnim-kkeyse cip-ey o-si-ess-ta.', '선생님-께서 집-에 오-시-었-다.', '선생님께서 집에 오시었다.'],
  ['[Chelswu-ka ecey ilk-un] chayk-i caymiiss-ess-ta.', '[철수-가 어제 읽-은] 책-이 재미있-었-다.', '[철수가 어제 읽은] 책이 재미있었다.'],
  ['yeyppu-n kkoch-i phi-ess-ta.', '예쁘-ㄴ 꽃-이 피-었-다.', '예쁜 꽃이 피었다.'],
  ['nayil mek-ul umsik-ul sa-nta.', '내일 먹-을 음식-을 사-ㄴ다.', '내일 먹을 음식을 산다.'],
  ['ku-nun tayhaksayng-i-ta.', '그-는 대학생-이-다.', '그는 대학생이다.'],
  ['eti-ey ka-ni?', '어디-에 가-니?', '어디에 가니?'],
  ['wuli-nun tosekwan-eyse kongpuha-yess-ta.', '우리-는 도서관-에서 공부하-였-다.', '우리는 도서관에서 공부하였다.'],
  ['ai-tul-i wuntongcang-eyse nol-ko iss-ta.', '아이-들-이 운동장-에서 놀-고 있-다.', '아이들이 운동장에서 놀고 있다.'],
  ['halmeni-kkeyse sonca-eykey senmul-ul cwu-si-ess-ta.', '할머니-께서 손자-에게 선물-을 주-시-었-다.', '할머니께서 손자에게 선물을 주시었다.'],
  ['i muncey-nun elyep-ci anh-ta.', '이 문제-는 어렵-지 않-다.', '이 문제는 어렵지 않다.'],
  ['ku yenghwa-lul po-n cek-i iss-ta.', '그 영화-를 보-ㄴ 적-이 있-다.', '그 영화를 본 적이 있다.'],
  ['hyeng-i tongsayng-pota khi-ka khu-ta.', '형-이 동생-보다 키-가 크-다.', '형이 동생보다 키가 크다.'],
  ['palam-i pul-myen kkochiph-i tteleci-nta.', '바람-이 불-면 꽃잎-이 떨어지-ㄴ다.', '바람이 불면 꽃잎이 떨어진다.'],
  ['ikes-un nay kes-i-ko cekes-un ney kes-i-ta.', '이것-은 내 것-이-고 저것-은 네 것-이-다.', '이것은 내 것이고 저것은 네 것이다.'],
  ['ttalase twu muncang-uy uymi-nun talu-ta.', '따라서 두 문장-의 의미-는 다르-다.', '따라서 두 문장의 의미는 다르다.'],
  ['Chelswu-nun [Yenghuy-ka o-n-ta-ko] sayngkakha-n-ta.', '철수-는 [영희-가 오-ㄴ-다-고] 생각하-ㄴ-다.', '철수는 [영희가 온다고] 생각한다.'],
  ['Chelswu-ka [Yenghuy-ka ttena-ss-ta-nun] sasil-ul al-ass-ta.', '철수-가 [영희-가 떠나-ㅆ-다-는] 사실-을 알-았-다.', '철수가 [영희가 떠났다는] 사실을 알았다.'],
  ['apeci-kkeyse sinmun-ul ilk-usi-n-ta.', '아버지-께서 신문-을 읽-으시-ㄴ-다.', '아버지께서 신문을 읽으신다.'],
  ['nwun-i o-myen kil-i mikkulep-ta.', '눈-이 오-면 길-이 미끄럽-다.', '눈이 오면 길이 미끄럽다.'],
  ['ka-lkka? ka-psita.', '가-ㄹ까? 가-ㅂ시다.', '갈까? 갑시다.'],
  ['sensayng-nim-i o-si-n-ta.', '선생-님-이 오-시-ㄴ-다.', '선생님이 오신다.'],
];

// 영어 이름(그대로)·공범주 e와 지표·인용형 어미
const NAMES_AND_NOTATION = [
  ['John-i Mary-lul manna-ss-ta.', 'John-이 Mary-를 만나-ㅆ-다.', 'John-이 Mary-를 만났다.'],
  ['Mary-ka John-eykey chayk-ul cwu-ess-ta.', 'Mary-가 John-에게 책-을 주-었-다.', 'Mary-가 John-에게 책을 주었다.'],
  ['ce [e1 khi-ka khu]-n1 yeca', '저 [e1 키-가 크]-ㄴ1 여자', '저 [e1 키가 크]-ㄴ1 여자'],
  ['[e1 chayk-ul ilk-un] haksayng-i1 cip-ey ka-ss-ta.', '[e1 책-을 읽-은] 학생-이1 집-에 가-ㅆ-다.', '[e1 책을 읽은] 학생이1 집에 갔다.'],
  ['-(u)n, -(u)l, -ko, -nta, -ess-, -keyss-', '-(으)ㄴ, -(으)ㄹ, -고, -ㄴ다, -었-, -겠-', '-(으)ㄴ, -(으)ㄹ, -고, -ㄴ다, -었-, -겠-'],
  ['IP-uy cwue-nun NP-i-ta.', 'IP-의 주어-는 NP-이-다.', 'IP-의 주어는 NP-이다.'],
];

// [Yale, 한글] — 분절하지 않은 문장
const UNSEGMENTED = [
  ['chelswuka chaykul ilkessta.', '철수가 책을 읽었다.'],
  ['i nonmunun hankwukeuy kyekcosalul talwunta.', '이 논문은 한국어의 격조사를 다룬다.'],
  ['ku salamun ecey tosekwaneyse kongpuhayssta.', '그 사람은 어제 도서관에서 공부했다.'],
  ['kulena i punsekeynun munceyka issta.', '그러나 이 분석에는 문제가 있다.'],
  ['wulinun ttohan i hyensangul selmyenghal swu issta.', '우리는 또한 이 현상을 설명할 수 있다.'],
  ['nanun hankwuke kyosaipnita.', '나는 한국어 교사입니다.'],
  ['i yeymunun munpepcekulo esaykhata.', '이 예문은 문법적으로 어색하다.'],
  ['taum yeylul poca.', '다음 예를 보자.'],
  ['ilehan chainun tongsauy uymieyse pilostoynta.', '이러한 차이는 동사의 의미에서 비롯된다.'],
  ['haksayngtuli sensayngnimkkey cilmunul hayssta.', '학생들이 선생님께 질문을 했다.'],
  ['pika wase kili mikkulewessta.', '비가 와서 길이 미끄러웠다.'],
];

// [Yale, 정답] — 표기상 둘 다 가능해 문맥 없이는 정할 수 없는 어형 (주석은 현재 1위).
// 사용자 사전으로 한 번 고치면 다음부터는 그 결과가 쓰인다
const AMBIGUOUS = [
  ['tuli-ess-ta', '드리었다'], // 들이었다
  ['aphu-n', '아픈'], // 앞은
  ['kulemulo', '그러므로'], // 그럼으로
  ['Mali-nun', '마리는'], // 말이는 (이름 Mary)
  ['ilul', '일을'], // 이를
  ['eswuni', '어순이'], // 어수니
];

describe('자작 예문 회귀 (빈도 데이터 주입)', () => {
  before(() => {
    const data = JSON.parse(readFileSync(join(__dirname, '..', 'data', 'syllable-freq.json'), 'utf8'));
    setFrequencyData({ syllable: data.u, bigram: data.b, word: data.w });
  });
  after(() => setFrequencyData({}));

  test('형태소 분절 예문', () => {
    for (const [yale, keep, plain] of SEGMENTED) {
      assert.equal(reverseConvert(yale, { keepHyphens: true }), keep, yale);
      assert.equal(reverseConvert(yale), plain, yale);
    }
  });

  test('영어 이름·표기 기호', () => {
    for (const [yale, keep, plain] of NAMES_AND_NOTATION) {
      assert.equal(reverseConvert(yale, { keepHyphens: true }), keep, yale);
      assert.equal(reverseConvert(yale), plain, yale);
    }
  });

  test('분절하지 않은 문장', () => {
    for (const [yale, hangul] of UNSEGMENTED) assert.equal(reverseConvert(yale), hangul, yale);
  });

  test('문맥이 필요한 동형어는 5후보 안에', () => {
    for (const [yale, hangul] of AMBIGUOUS) {
      const cands = parseYaleWordCandidates(yale, {}, 5).map((c) => c.hangul);
      assert.ok(cands.includes(hangul), `${yale}: ${cands.join(', ')}`);
    }
  });
});
