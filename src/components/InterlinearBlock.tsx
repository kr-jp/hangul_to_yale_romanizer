// 인터리니어 블록 — 윗줄 원문 토큰, 아랫줄 변환 (설계 문서 §4.4)
// 카드 클릭 = formatSingleGlossedExample 결과 복사(탭 치환 없음, §4.2 — 글로스 없으면 내부 위임으로 현행과 바이트 동일).
// y2h 모호어(후보>1)는 Popover로 후보 교체 — 클릭이 카드 복사로 버블되지 않게 차단.
// 글로스 모드(Stage 5 §2.1): 어절-컬럼 레이아웃 + 어절별 글로스 input. off면 현행 2행 그대로.
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useI18n } from '@/hooks/useI18n';
import { copyText } from '@/lib/clipboard';
import { cn } from '@/lib/utils';
import { formatSingleGlossedExample } from '@/lib/gloss-format.js';
import type { OutputFormat, YaleCandidate } from '@/lib/types';

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
  onOverride(word: string, hangul: string): void;
  onGlossChange(tokenIndex: number, value: string): void; // Panel이 lineKey 커링
}

// y2h 모호어 1개 — 점선 밑줄 + 클릭 시 후보 Popover (원본 .inter-word.ambiguous / .edited)
function CandidateWord({
  roma,
  candidates,
  selected,
  edited,
  onSelect,
}: {
  roma: string;
  candidates: YaleCandidate[];
  selected: string | undefined; // 현재 선택값 — override 우선, 아니면 best (원본 currentSelected)
  edited: boolean;
  onSelect(hangul: string): void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          role="button"
          // 모호어 클릭이 카드 복사로 버블되면 안 됨 (§4.4)
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'inline-block cursor-pointer rounded-xs border-b border-dotted border-primary px-px transition-colors hover:bg-accent hover:text-accent-foreground',
            // override된 모호어 — 점선 대신 실선 (원본 .edited)
            edited && 'border-solid font-medium text-primary',
          )}
        >
          {roma}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-72 w-auto min-w-36 overflow-auto p-1"
        // Portal 내부 클릭도 React 트리상 카드로 버블되므로 차단
        onClick={(e) => e.stopPropagation()}
      >
        {candidates.map((c, i) => {
          const isSelected = c.hangul === selected;
          return (
            <button
              key={`${i}-${c.hangul}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(c.hangul);
                setOpen(false);
              }}
              className={cn(
                // H1 동일 원칙: 후보는 한글이므로 sans
                'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left font-sans text-sm hover:bg-muted',
                isSelected && 'bg-accent font-semibold text-accent-foreground',
              )}
            >
              {isSelected && <span aria-hidden className="text-xs text-primary">✓</span>}
              <span>{c.hangul}</span>
              {/* 첫 번째(best) 강조 — selected와 겹치면 ✓만 (원본 .best.selected) */}
              {i === 0 && !isSelected && <span aria-hidden className="ml-auto text-[11px] text-primary">★</span>}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
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
  onOverride,
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
    void copyText(text).then(() => toast(t('copied'), { duration: 2000 }));
  };

  // y2h 아랫줄 1어절 — 모호어는 CandidateWord(Popover), 아니면 텍스트 (2행·컬럼 레이아웃 공용)
  const renderRoma = (i: number) => {
    const candidates = candidatesByWord?.[i] || [];
    if (candidatesByWord && candidates.length > 1) {
      return (
        <CandidateWord
          roma={romas[i]}
          candidates={candidates}
          selected={wordOverrides.get(tokens[i]) || candidates[0]?.hangul}
          edited={wordOverrides.has(tokens[i])}
          onSelect={(hangul) => onOverride(tokens[i], hangul)}
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
          romas.map((roma, i) => {
            const candidates = candidatesByWord[i] || [];
            const ambiguous = candidates.length > 1;
            return (
              <Fragment key={i}>
                {ambiguous ? (
                  <CandidateWord
                    roma={roma}
                    candidates={candidates}
                    selected={wordOverrides.get(tokens[i]) || candidates[0]?.hangul}
                    edited={wordOverrides.has(tokens[i])}
                    onSelect={(hangul) => onOverride(tokens[i], hangul)}
                  />
                ) : (
                  <span>{roma}</span>
                )}
                {i < romas.length - 1 ? ' ' : null}
              </Fragment>
            );
          })
        ) : (
          romas.join(' ')
        )}
      </div>
    </div>
  );
}
