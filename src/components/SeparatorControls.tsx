// 구분자 컨트롤 — maxLength=1 입력 + 미리보기 + 칩 6개 (설계 문서 §1, §4.12)
// 칩은 ToggleGroup 대신 버튼 사용: Radix ToggleGroup은 value=''(∅ 칩)를 비선택과 구분하지 못함
import { useI18n } from '@/hooks/useI18n';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';

const SEP_CHIPS = ['', ' ', '·', '-', '.', '/'] as const;

function displaySep(c: string): string {
  if (c === '') return '∅';
  if (c === ' ') return '␣';
  return c;
}

interface SeparatorControlsProps {
  sepChar: string;
  onSepChange(v: string): void;
}

export default function SeparatorControls({ sepChar, onSepChange }: SeparatorControlsProps) {
  const { t } = useI18n();
  const effective = (sepChar || '').slice(0, 1);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
      <Input
        value={sepChar}
        maxLength={1}
        placeholder={t('sepPlaceholder')}
        onChange={(e) => onSepChange(e.target.value)}
        aria-label={t('labelSep')}
        className="h-8 w-12 text-center font-mono"
      />
      <span className="w-5 text-center font-mono text-sm text-muted-foreground" aria-hidden="true">
        {displaySep(effective)}
      </span>
      <div className="flex items-center gap-1" role="group" aria-label={t('labelSep')}>
        {SEP_CHIPS.map((c) => (
          <button
            key={displaySep(c)}
            type="button"
            onClick={() => onSepChange(c)}
            className={cn(
              'inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-2 font-mono text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              c === effective
                ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
            aria-pressed={c === effective}
          >
            {displaySep(c)}
          </button>
        ))}
      </div>
    </div>
  );
}
