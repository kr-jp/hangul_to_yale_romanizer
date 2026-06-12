// y2h 빈도 데이터 lazy load — fetch → dynamic import 대체 (설계 문서 §4.11)
// Vite가 별도 청크로 분리하므로 h2y만 쓰는 사용자는 다운로드하지 않는다.
// 1회 캐시 + 실패 시 캐시 리셋(재시도 가능). 데이터 없으면 y2h는 탐욕 파서 폴백으로 정상 동작.
import { useEffect, useState } from 'react';
import { setFrequencyData } from '../converter/y2h.js';
import type { Direction } from '../lib/types';

interface FreqJson {
  u?: Record<string, number>;
  b?: Record<string, number>;
  w?: Record<string, number>;
}

// allowJs 추론은 기본값(null)에서 파라미터를 null로 좁히므로 경계에서 시그니처를 명시 (원본 .js 수정 금지)
const setFreq = setFrequencyData as unknown as (d: {
  syllable?: object | null;
  bigram?: object | null;
  word?: object | null;
}) => void;

let _freqLoadPromise: Promise<boolean> | null = null;

function loadFrequencyData(): Promise<boolean> {
  if (_freqLoadPromise) return _freqLoadPromise;
  _freqLoadPromise = import('../../data/syllable-freq.json')
    .then((mod) => {
      const data = (mod as { default: unknown }).default as FreqJson;
      setFreq({ syllable: data.u || null, bigram: data.b || null, word: data.w || null });
      return true;
    })
    .catch((err: unknown) => {
      console.warn('[Yale] 빈도 데이터 로딩 실패, 기본 파서 사용:', err);
      _freqLoadPromise = null; // 실패 시 다음 시도 가능하게
      return false;
    });
  return _freqLoadPromise;
}

// 반환값 = freqVersion. 로드 완료 시 증가 → 출력 useMemo 의존성으로 재계산 트리거
export function useFrequencyData(direction: Direction): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (direction !== 'y2h') return;
    let cancelled = false;
    void loadFrequencyData().then((ok) => {
      if (ok && !cancelled) setVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [direction]);

  return version;
}
