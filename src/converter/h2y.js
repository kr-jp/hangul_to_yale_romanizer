// 한글 → Yale 로마자 변환
import { toJamo, J2Y, BILABIALS } from './hangul.js';

// 양순음(ㅁㅂㅃㅍ) 뒤의 ㅜ는 ㅡ로 표기 (Yale 양순음 규칙)
export function applyLabialRule(jamoStr) {
  const arr = Array.from(jamoStr);
  for (let i = 0; i < arr.length - 1; i++) {
    if (BILABIALS.has(arr[i]) && arr[i + 1] === 'ㅜ') {
      arr[i + 1] = 'ㅡ';
    }
  }
  return arr.join('');
}

// 자모 → Yale 토큰. 비-자모(공백/문장부호 등)는 delim:true로 보존하여
// 구분자 삽입 단계에서 양옆에 sep을 넣지 않도록 표시
export function tokenizeYale(jamoStr) {
  const tokens = [];
  for (const ch of jamoStr) {
    if (Object.prototype.hasOwnProperty.call(J2Y, ch)) {
      tokens.push({ s: J2Y[ch], delim: false });
    } else {
      tokens.push({ s: ch, delim: true });
    }
  }
  return tokens;
}

// 토큰 결합. sep은 인접한 자모 토큰 사이에만 삽입
export function joinWithSep(tokens, sep) {
  if (!sep) return tokens.map(t => t.s).join('');
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i];
    out += cur.s;
    const next = tokens[i + 1];
    if (!next) break;
    if (!cur.delim && !next.delim) out += sep;
  }
  return out;
}

export function convert(text, { labial = true, sep = '' } = {}) {
  if (!text || !text.trim()) return '';
  // 분해형(NFD) 한글(macOS·PDF에서 복사한 텍스트 등)은 완성형으로 합친 뒤 변환
  const nfc = text.normalize('NFC');
  // 양순음 규칙은 음절 하나 안에서만 적용한다. 초성 ㅇ은 Yale에서 생략되므로 자모열 전체에 적용하면
  // 받침 ㅁ·ㅂ·ㅍ 뒤 음절의 '우'까지 u가 된다 (삼우제 → samucey, 남우 = 나무).
  // 완성형 음절이 아닌 구간(낱자모로 쓴 ㅂㅜ 등)은 종전대로 구간 전체에 적용
  const jamo = labial
    ? nfc.replace(/[가-힣]|[^가-힣]+/g, (piece) => applyLabialRule(toJamo(piece)))
    : toJamo(nfc);
  const tokens = tokenizeYale(jamo);
  return joinWithSep(tokens, sep);
}
