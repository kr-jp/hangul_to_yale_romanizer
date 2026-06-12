// 인터리니어 패널 (설계 문서 §4.4)
// interlinear=true면 입력이 비어도 타이틀+힌트만 표시 (베이스라인과 동일).
// 줄(splitLines)당 InterlinearBlock 1개 — y2h는 토큰별 후보 5개 + override 반영.
import InterlinearBlock from './InterlinearBlock';
import { useI18n } from '@/hooks/useI18n';
import { pickPreferred } from '@/lib/convert-pipeline';
import { convert } from '../converter/h2y.js';
import { parseYaleWordCandidates } from '../converter/y2h.js';
import type { ConvertOpts, Direction, OutputFormat, YaleCandidate } from '@/lib/types';

export interface InterlinearPanelProps {
  visible: boolean;
  direction: Direction;
  lines: string[];
  opts: ConvertOpts;
  format: OutputFormat;
  numbered: boolean;
  wordOverrides: ReadonlyMap<string, string>;
  // 글로스 (Stage 5 §2.4). glosses key = 줄 텍스트(trim) — Block에는 패딩 완료본·커링 콜백 전달
  glossEnabled: boolean;
  glosses: ReadonlyMap<string, string[]>;
  tabCopy: boolean; // タブ区切り — 카드 복사의 탭 치환 여부 (Block에 전달)
  onGlossChange(lineKey: string, tokenIndex: number, value: string): void;
  onOverride(word: string, hangul: string): void;
}

export default function InterlinearPanel({
  visible,
  direction,
  lines,
  opts,
  format,
  numbered,
  wordOverrides,
  glossEnabled,
  glosses,
  tabCopy,
  onGlossChange,
  onOverride,
}: InterlinearPanelProps) {
  const { t } = useI18n();
  if (!visible) return null;

  // 빈도 데이터 로드(freqVersion) 등 props 외 요인으로 후보가 바뀌므로
  // 의도적으로 useMemo 없이 매 렌더 계산 (원본 updateAll과 동일 타이밍)
  const blocks = lines.map((line) => {
    const tokens = line.split(/\s+/).filter(Boolean);
    let romas: string[];
    let candidatesByWord: YaleCandidate[][] | null = null;
    if (direction === 'y2h') {
      candidatesByWord = tokens.map((tk) => parseYaleWordCandidates(tk, opts, 5));
      romas = candidatesByWord.map((cs, i) => pickPreferred(tokens[i], cs, wordOverrides));
    } else {
      romas = tokens.map((tk) => convert(tk, opts));
    }
    // 글로스 부착 + 토큰 수 패딩/절단 — 키 미스매치(줄 수정)는 빈칸으로 자연 무효화 (§2.2)
    const raw = glosses.get(line) || [];
    const gloss = tokens.map((_, i) => raw[i] ?? '');
    return { line, tokens, romas, candidatesByWord, gloss };
  });

  return (
    <section
      aria-label={t('ttlInterlinear')}
      className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-sm md:p-6"
    >
      <h2 className="text-[13px] font-semibold text-muted-foreground">{t('ttlInterlinear')}</h2>
      {blocks.length > 0 && (
        <div className="grid gap-2">
          {blocks.map((b, idx) => (
            <InterlinearBlock
              key={idx}
              index={idx}
              tokens={b.tokens}
              romas={b.romas}
              candidatesByWord={b.candidatesByWord}
              wordOverrides={wordOverrides}
              format={format}
              numbered={numbered}
              glossEnabled={glossEnabled}
              gloss={b.gloss}
              tabCopy={tabCopy}
              onGlossChange={(tokenIndex, value) => onGlossChange(b.line, tokenIndex, value)}
              onOverride={onOverride}
            />
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('hintInterlinear')}</p>
      {/* 글로스 모드 안내 — hintInterlinear 대체 아님 (카드 복사 안내는 여전히 유효, §3) */}
      {glossEnabled && <p className="text-xs text-muted-foreground">{t('hintGloss')}</p>}
    </section>
  );
}
