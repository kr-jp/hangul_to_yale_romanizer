// 출력 텍스트 생성 훅 — 보통 크기는 동기 계산(useMemo), 대량 입력은 Web Worker에서 계산.
// 대량 입력에서는 계산 중(pending) 동안 직전 결과를 보여 주고, 연속 입력은 짧게 모아서 한 번만 보낸다
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildFormattedOutput } from '@/lib/convert-pipeline';
import type { ConvertRequest, ConvertResponse } from '@/lib/convert.worker';
import type { ConvertOpts, Direction, OutputFormat } from '@/lib/types';

// 이보다 긴 입력은 Worker로 (약 3,000어절 — 이하에서는 동기 계산이 타이핑을 방해하지 않는다)
export const WORKER_THRESHOLD = 30_000;
const WORKER_DEBOUNCE_MS = 150;

export interface OutputParams {
  text: string;
  opts: ConvertOpts;
  format: OutputFormat;
  numbered: boolean;
  direction: Direction;
  overrides: ReadonlyMap<string, string>;
  glossEnabled: boolean;
  glosses: ReadonlyMap<string, string[]>;
  freqVersion: number; // 메인 스레드의 빈도 데이터가 로드되면 동기 결과를 다시 계산
}

function convertNow(r: OutputParams): string {
  return buildFormattedOutput(r.text, r.opts, r.format, r.numbered, r.direction, r.overrides, {
    enabled: r.glossEnabled,
    map: r.glosses,
  });
}

export function useConvertedOutput(p: OutputParams): { output: string; pending: boolean } {
  const large = p.text.length > WORKER_THRESHOLD;
  const { text, opts, format, numbered, direction, overrides, glossEnabled, glosses, freqVersion } = p;

  // 입력이 바뀔 때마다 새 객체 — 그 렌더에서 바로 '결과가 최신인가'를 판정하는 식별자로도 쓴다
  const request = useMemo<OutputParams>(
    () => ({ text, opts, format, numbered, direction, overrides, glossEnabled, glosses, freqVersion }),
    [text, opts, format, numbered, direction, overrides, glossEnabled, glosses, freqVersion],
  );
  const syncOutput = useMemo(() => (large ? '' : convertNow(request)), [large, request]);

  const [result, setResult] = useState<{ request: OutputParams; output: string } | null>(null);
  const latest = useRef(request);
  const workerRef = useRef<Worker | null>(null);
  const workerFailed = useRef(false);
  const inflight = useRef(new Map<number, OutputParams>());
  const seq = useRef(0);

  useEffect(() => {
    latest.current = request;
    if (!large) return;
    const timer = window.setTimeout(() => {
      // Worker를 쓸 수 없는 환경이면 메인 스레드에서 계산 (느리지만 결과는 같다)
      if (workerFailed.current) {
        setResult({ request, output: convertNow(request) });
        return;
      }
      if (!workerRef.current) {
        const w = new Worker(new URL('../lib/convert.worker.ts', import.meta.url), { type: 'module' });
        w.onmessage = (e: MessageEvent<ConvertResponse>) => {
          const req = inflight.current.get(e.data.id);
          inflight.current.delete(e.data.id);
          if (req && req === latest.current) setResult({ request: req, output: e.data.output });
        };
        w.onerror = () => {
          workerFailed.current = true;
          w.terminate();
          workerRef.current = null;
          inflight.current.clear();
          setResult({ request: latest.current, output: convertNow(latest.current) });
        };
        workerRef.current = w;
      }
      const id = ++seq.current;
      inflight.current.set(id, request);
      const msg: ConvertRequest = {
        id,
        text: request.text,
        opts: request.opts,
        format: request.format,
        numbered: request.numbered,
        direction: request.direction,
        overrides: [...request.overrides],
        gloss: { enabled: request.glossEnabled, entries: [...request.glosses] },
      };
      workerRef.current.postMessage(msg);
    }, WORKER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [large, request]);

  useEffect(
    () => () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    },
    [],
  );

  if (!large) return { output: syncOutput, pending: false };
  return { output: result?.output ?? '', pending: result?.request !== request };
}
