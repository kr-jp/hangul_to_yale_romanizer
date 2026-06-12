// 액션 바 — 복사(primary)·다운로드(outline)·백업(ghost+tooltip)·형식 칩·URL 공유(우측 정렬)
// Stage 3에서는 복사·형식 칩만 동작. 다운로드/백업/공유 핸들러는 Stage 4C에서 구현 (설계 문서 §1, §7)
import { ArchiveIcon, CopyIcon, DownloadIcon, ShareIcon } from 'lucide-react';
import { Button } from './ui/button';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useI18n } from '@/hooks/useI18n';
import type { OutputFormat } from '@/lib/types';

// 형식 칩 라벨 하드코딩 유지 (설계 문서 §6)
// Gloss(TSV) 칩은 사용자 결정(2026-06-12)으로 제거 — グロス編集 ON이면 Plain 등에 글로스 행이
// 자동 포함되고, 복사 시 탭 치환이 TSV를 대체하므로 중복 기능. 내부 'gloss' 형식은 lib에 유지
const FORMAT_ITEMS: ReadonlyArray<{ value: OutputFormat; label: string }> = [
  { value: 'plain', label: 'Plain' },
  { value: 'latex', label: 'LaTeX' },
  { value: 'markdown', label: 'Markdown' },
];

interface ActionBarProps {
  output: string;
  format: OutputFormat;
  onFormatChange(f: OutputFormat): void;
  onCopy(): void;
  onDownload(): void;
  onBackup(): void;
  onShare(): void;
}

export default function ActionBar({
  format,
  onFormatChange,
  onCopy,
  onDownload,
  onBackup,
  onShare,
}: ActionBarProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* L2: 모바일에서 복사·다운로드·백업 3개가 1행에 들어가도록 sm 크기로 축소 */}
      <Button className="max-md:h-8 max-md:px-3 max-md:text-xs" onClick={onCopy}>
        <CopyIcon />
        {t('copyBtn')}
      </Button>
      <Button variant="outline" className="max-md:h-8 max-md:px-3 max-md:text-xs" onClick={onDownload}>
        <DownloadIcon />
        {t('labelDownload')}
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" className="max-md:h-8 max-md:px-3 max-md:text-xs" onClick={onBackup}>
            <ArchiveIcon />
            {t('labelBackup')}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('backupTooltip')}</TooltipContent>
      </Tooltip>
      {/* L1: ghost '백업'과 '출력 형식' 캡션의 그룹 경계 구분용 세퍼레이터 */}
      <div aria-hidden className="h-4 w-px bg-border max-md:hidden" />
      {/* H3: 390px에서 라벨이 2줄로 꺾이지 않도록 모바일은 라벨 상단 + 칩 풀폭 스택 (stage0 패턴) */}
      <div className="flex w-full flex-col items-start gap-1.5 md:w-auto md:flex-row md:items-center md:gap-2">
        <span className="whitespace-nowrap text-sm text-muted-foreground">{t('labelFormat')}</span>
        <ToggleGroup
          className="max-md:w-full"
          type="single"
          value={format}
          onValueChange={(v) => {
            // 활성 칩 재클릭(빈 value)·동일 형식은 무시 (원본 dom.js와 동일)
            if (FORMAT_ITEMS.some((f) => f.value === v) && v !== format) {
              onFormatChange(v as OutputFormat);
            }
          }}
          aria-label={t('labelFormat')}
        >
          {FORMAT_ITEMS.map((f) => (
            <ToggleGroupItem key={f.value} value={f.value} className="max-md:flex-1">
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <Button variant="outline" className="ml-auto" onClick={onShare}>
        <ShareIcon />
        {t('labelShare')}
      </Button>
    </div>
  );
}
