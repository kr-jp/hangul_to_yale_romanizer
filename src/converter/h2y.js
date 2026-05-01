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
  let jamo = toJamo(text);
  if (labial) jamo = applyLabialRule(jamo);
  const tokens = tokenizeYale(jamo);
  return joinWithSep(tokens, sep);
}
