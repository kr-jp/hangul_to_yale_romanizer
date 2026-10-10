// 인터리니어 블록 — 윗줄 원문 토큰, 아랫줄 변환 (설계 문서 §4.4)
// 카드 클릭 = formatSingleGlossedExample 결과 복사(Plain + タブ区切り ON이면 공백→탭, 글로스 없으면 내부 위임으로 현행과 바이트 동일).
// y2h 아랫줄 어절은 WordPopover로 후보 선택·직접 입력(사용자 사전) — 클릭이 카드 복사로 버블되지 않게 차단.
// 글로스 모드(Stage 5 §2.1): 어절-컬럼 레이아웃 + 어절별 글로스 input. off면 현행 2행 그대로.
import { Fragment } from 'react';
import { toast } from 'sonner';
import WordPopover from './WordPopover';
import { useI18n } from '@/hooks/useI18n';
import { copyText } from '@/lib/clipboard';
import { cn } from '@/lib/utils';
import { formatSingleGlossedExample } from '@/lib/gloss-format.js';
import { isEditableToken } from '@/lib/user-dict';
import type { OutputFormat, WordEditor, YaleCandidate } from '@/lib/types';

export interface InterlinearBlockProps {
  index: number;
  tokens: string[];
  romas: string[];
  candidatesByWord: YaleCandidate[][] | null; // h2y는 null
  wordOverrides: ReadonlyMap<string, string>;
  format: OutputFormat;
  numbered: boolean;
  glossEnabled: boolean;
  gloss: string[]; // 토큰 수로 패딩 완료본 (Panel이 부착·패딩 — gloss-format은 길이 방어 안 함)
  tabCopy: boolean; // タブ区切り — Plain 복사 시 공백→탭 치환 (메인 복사 버튼과 통일)
  onCopied?(): void; // 카드 복사 시 호출 (히스토리 확정용)
  editor: WordEditor | null; // y2h 어절 편집 (h2y는 null)
  onGlossChange(tokenIndex: number, value: string): void; // Panel이 lineKey 커링
}

export default function InterlinearBlock({
  index,
  tokens,
  romas,
  candidatesByWord,
  wordOverrides,
  format,
  numbered,
  glossEnabled,
  gloss,
  tabCopy,
  onCopied,
  editor,
  onGlossChange,
}: InterlinearBlockProps) {
  const { t } = useI18n();

  // 카드 클릭 = 현재 형식으로 단일 예문 복사.
  // タブ区切り ON이면 Plain에서 공백 run → 탭 치환 — 메인 복사 버튼과 동일 규칙 (2026-06-12 통일)
  const handleCopy = () => {
    const raw = formatSingleGlossedExample(tokens, romas, glossEnabled ? gloss : undefined, format, {
      numbered,
      exampleIndex: index,
    });
    const text = format === 'plain' && tabCopy ? raw.replace(/[^\S\r\n]+/g, '\t') : raw;
    onCopied?.();
    void copyText(text).then(() => toast(t('copied'), { duration: 2000 }));
  };

  // y2h 아랫줄 1어절 — 고칠 수 있는 어절(Yale run 1개)·모호어는 WordPopover, 아니면 텍스트 (2행·컬럼 레이아웃 공용)
  const renderRoma = (i: number) => {
    const candidates = candidatesByWord?.[i] || [];
    const editable = isEditableToken(tokens[i]);
    if (candidatesByWord && editor && (editable || candidates.length > 1)) {
      return (
        <WordPopover
          token={tokens[i]}
          roma={romas[i]}
          candidates={candidates}
          selected={wordOverrides.get(tokens[i]) || candidates[0]?.hangul}
          edited={wordOverrides.has(tokens[i])}
          editable={editable}
          editor={editor}
        />
      );
    }
    return <span>{romas[i]}</span>;
  };

  if (glossEnabled) {
    // 어절-컬럼 레이아웃 — flex-wrap으로 어절 컬럼이 통째로 줄바꿈 (§2.1)
    return (
      <div
        onClick={handleCopy}
        className="cursor-pointer rounded-lg border border-border bg-card px-3.5 py-3 transition-colors hover:border-ring hover:bg-accent/40"
      >
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {tokens.map((tk, i) => {
            const value = gloss[i] ?? '';
            return (
              <div key={i} className="inline-flex flex-col items-start gap-0.5">
                {/* H1 폰트 분리는 2행 레이아웃과 동일 — 윗줄: h2y=sans / y2h=mono */}
                <span
                  className={cn(
                    'text-[15px] leading-relaxed text-foreground',
                    candidatesByWord ? 'font-mono' : 'font-sans',
                  )}
                >
                  {tk}
                </span>
                <span
                  className={cn(
                    'text-[15px] leading-relaxed text-muted-foreground',
                    candidatesByWord ? 'font-sans' : 'font-mono',
                  )}
                >
                  {renderRoma(i)}
                </span>
                <input
                  value={value}
                  onChange={(e) => onGlossChange(i, e.target.value)}
                  // 입력 클릭이 카드 복사로 버블되면 안 됨 (CandidateWord와 동일 규칙)
                  onClick={(e) => e.stopPropagation()}
                  placeholder={t('glossPlaceholder')}
                  aria-label={`${t('labelGloss')}: ${tk}`}
                  spellCheck={false}
                  // 너비: min-w-full로 컬럼 자연 폭(max-content = max(토큰, 로마자)) 채움 +
                  // field-sizing:content로 입력 내용이 더 길면 컬럼과 함께 늘어남.
                  // (구 ch 계산은 CJK가 1ch보다 넓어 과소 측정 → 글로스 잘림이라 제거)
                  // size=4: field-sizing 미지원 브라우저에서 input 기본 고유폭(~20ch)이
                  // 컬럼을 부풀리지 않게 — 그 경우 min-w-full(컬럼 폭)만으로 동작
                  size={4}
                  className="min-w-full [field-sizing:content] rounded-md border border-input bg-background px-1.5 py-0.5 font-mono text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleCopy}
      className="cursor-pointer rounded-lg border border-border bg-card px-3.5 py-3 transition-colors hover:border-ring hover:bg-accent/40"
    >
      {/* H1: 줄별 언어에 맞춰 폰트 분리 — 윗줄(원문): h2y=한글 sans / y2h=Yale mono, 아랫줄은 반대 */}
      <div
        className={cn(
          'whitespace-pre-wrap text-[15px] leading-relaxed text-foreground',
          candidatesByWord ? 'font-mono' : 'font-sans',
        )}
      >
        {tokens.join(' ')}
      </div>
      <div
        className={cn(
          'mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-muted-foreground',
          candidatesByWord ? 'font-sans' : 'font-mono',
        )}
      >
        {candidatesByWord ? (
          romas.map((_, i) => (
            <Fragment key={i}>
              {renderRoma(i)}
              {i < romas.length - 1 ? ' ' : null}
            </Fragment>
          ))
        ) : (
          romas.join(' ')
        )}
      </div>
    </div>
  );
}
