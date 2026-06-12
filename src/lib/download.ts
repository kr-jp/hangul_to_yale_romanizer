// 파일 다운로드·백업 JSON 생성 — 원본 dom.js의 downloadResult/downloadBackup 이식 (설계 문서 §4.5–4.6)
import type { ConvertOpts, Direction, OutputFormat } from './types';

export const FORMAT_FILE_INFO: Record<OutputFormat, { ext: string; mime: string }> = {
  plain: { ext: 'txt', mime: 'text/plain' },
  gloss: { ext: 'tsv', mime: 'text/tab-separated-values' },
  latex: { ext: 'tex', mime: 'application/x-tex' },
  markdown: { ext: 'md', mime: 'text/markdown' },
};

// 파일명용 타임스탬프 — 예: 2026-06-11T05-00-00
export function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// Blob → 임시 <a download> 클릭 → 1초 후 revokeObjectURL (원본과 동일)
export function downloadText(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface BackupArgs {
  direction: Direction;
  opts: ConvertOpts; // 유효 sep 포함 (getOpts 결과)
  sepEnabled: boolean;
  interlinear: boolean;
  format: OutputFormat;
  numbered: boolean;
  glossEnabled: boolean;
  input: string;
  output: string;
  wordOverrides: ReadonlyMap<string, string>;
  glosses: Record<string, string[]>; // 캡처 시점 필터 결과 (collectShareGlosses)
  shareUrl: string;
}

// 백업 JSON 객체 생성 — 키 순서는 §4.6 사양 그대로 (JSON.stringify가 삽입 순서를 보존)
// Stage 5: glossEnabled/glosses는 additive — 기존 키 순서 불변, version 1 유지 (§2.5)
export function buildBackup(args: BackupArgs) {
  return {
    version: 1,
    tool: 'Hangul ↔ Yale Romanizer',
    exportedAt: new Date().toISOString(),
    direction: args.direction,
    options: {
      labial: args.opts.labial,
      separator: args.opts.sep,
      separatorEnabled: args.sepEnabled,
      interlinear: args.interlinear,
      format: args.format,
      exampleNumbering: args.numbered,
      glossEnabled: args.glossEnabled,
    },
    input: args.input,
    output: args.output,
    wordOverrides: Object.fromEntries(args.wordOverrides),
    glosses: args.glosses,
    shareUrl: args.shareUrl,
  };
}
