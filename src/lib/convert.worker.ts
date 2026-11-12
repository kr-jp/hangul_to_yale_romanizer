// 대량 입력 변환 전용 Web Worker — 파일 드롭 등으로 수십만 자를 변환해도 화면이 멈추지 않게 한다.
// 메인 스레드와 같은 엔진·같은 빈도 데이터를 쓰므로 결과는 동기 경로와 동일하다
import { setFrequencyData } from '../converter/y2h.js';
import { buildFormattedOutput } from './convert-pipeline';
import type { ConvertOpts, Direction, OutputFormat, UserDict } from './types';

export interface ConvertRequest {
  id: number;
  text: string;
  opts: ConvertOpts;
  format: OutputFormat;
  numbered: boolean;
  direction: Direction;
  overrides: [string, string][];
  gloss: { enabled: boolean; entries: [string, string[]][] };
}

export interface ConvertResponse {
  id: number;
  output: string;
}

// 빈도 데이터(약 1.1MB)는 Yale→한글 변환이 처음 올 때 내려받는다 — 정적 import였을 때는 Worker 번들에 통째로
// 들어가, 한글→Yale 대량 입력에서도 받았다. 실패하면 메인 스레드와 같이 탐욕 파서로 변환 (다음 요청 때 다시 시도)
let freqLoad: Promise<void> | null = null;
function loadFrequencyData(): Promise<void> {
  freqLoad ??= import('../../data/syllable-freq.json')
    .then((mod) => {
      const data = mod.default as { u?: object; b?: object; w?: object };
      (setFrequencyData as (d: { syllable?: object | null; bigram?: object | null; word?: object | null }) => void)({
        syllable: data.u || null,
        bigram: data.b || null,
        word: data.w || null,
      });
    })
    .catch((err: unknown) => {
      console.warn('[Yale] 빈도 데이터 로딩 실패, 기본 파서 사용:', err);
      freqLoad = null;
    });
  return freqLoad;
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<ConvertRequest>) => void) | null;
  postMessage(msg: ConvertResponse): void;
};

// 사용자 사전은 메시지마다 복제되어 새 객체로 온다. 내용이 같으면 이전 객체를 계속 써서
// 엔진의 사전별 run 캐시를 살린다 (입력 중 재변환이 매번 처음부터 계산되지 않게)
let lastDict: UserDict | null = null;
let lastDictKey = '';
function stableDict(dict: UserDict | null | undefined): UserDict | null {
  if (!dict) return null;
  const key = JSON.stringify([[...dict.segment], [...dict.whole]]);
  if (key !== lastDictKey) {
    lastDictKey = key;
    lastDict = dict;
  }
  return lastDict;
}

scope.onmessage = async (e) => {
  const r = e.data;
  if (r.direction === 'y2h') await loadFrequencyData();
  const opts = { ...r.opts, dict: stableDict(r.opts.dict) };
  const output = buildFormattedOutput(r.text, opts, r.format, r.numbered, r.direction, new Map(r.overrides), {
    enabled: r.gloss.enabled,
    map: new Map(r.gloss.entries),
  });
  scope.postMessage({ id: r.id, output });
};
