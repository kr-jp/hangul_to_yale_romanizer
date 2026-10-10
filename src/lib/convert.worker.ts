// 대량 입력 변환 전용 Web Worker — 파일 드롭 등으로 수십만 자를 변환해도 화면이 멈추지 않게 한다.
// 메인 스레드와 같은 엔진·같은 빈도 데이터를 쓰므로 결과는 동기 경로와 동일하다
import freq from '../../data/syllable-freq.json';
import { setFrequencyData } from '../converter/y2h.js';
import { buildFormattedOutput } from './convert-pipeline';
import type { ConvertOpts, Direction, OutputFormat } from './types';

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

const data = freq as { u?: object; b?: object; w?: object };
(setFrequencyData as (d: { syllable?: object | null; bigram?: object | null; word?: object | null }) => void)({
  syllable: data.u || null,
  bigram: data.b || null,
  word: data.w || null,
});

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<ConvertRequest>) => void) | null;
  postMessage(msg: ConvertResponse): void;
};

scope.onmessage = (e) => {
  const r = e.data;
  const output = buildFormattedOutput(r.text, r.opts, r.format, r.numbered, r.direction, new Map(r.overrides), {
    enabled: r.gloss.enabled,
    map: new Map(r.gloss.entries),
  });
  scope.postMessage({ id: r.id, output });
};
