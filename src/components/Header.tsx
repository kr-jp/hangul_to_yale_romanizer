// 헤더 — h1/sub 하드코딩 유지 (설계 문서 §6), 테마·언어는 내부 훅 사용 (§1)
import { BookAIcon, MoonIcon, SunIcon } from 'lucide-react';
import DirectionToggle from './DirectionToggle';
import { Button } from './ui/button';
import { useI18n } from '@/hooks/useI18n';
import { useTheme } from '@/hooks/useTheme';
import type { Direction } from '@/lib/types';

interface HeaderProps {
  direction: Direction;
  onDirectionChange(d: Direction): void;
  onOpenHistory(): void;
  onOpenRef(): void;
  dictCount: number; // 저장된 사용자 사전 항목 수 (버튼에 표시)
  onOpenDict(): void;
}

export default function Header({
  direction,
  onDirectionChange,
  onOpenHistory,
  onOpenRef,
  dictCount,
  onOpenDict,
}: HeaderProps) {
  const { t, toggleLang } = useI18n();
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
      {/* M3: 본문 카드(max-w-5xl)와 좌측 에지 정렬 */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="whitespace-nowrap text-base font-bold tracking-tight">한글 ↔ Yale</h1>
          <p className="hidden whitespace-nowrap text-sm text-muted-foreground lg:block">
            Yale romanization for Korean linguistics
          </p>
        </div>
        {/* 좁은 화면: 버튼 여백을 줄여 한 줄에 들어가게 (사용자 사전 버튼이 추가되어 줄바꿈되던 문제) */}
        <div className="ml-auto flex flex-wrap items-center gap-0.5 sm:gap-1.5">
          <DirectionToggle value={direction} onChange={onDirectionChange} />
          <Button variant="ghost" size="sm" className="px-2 sm:px-3" onClick={onOpenHistory} aria-haspopup="dialog">
            {t('openHist')}
          </Button>
          <Button variant="ghost" size="sm" className="px-2 sm:px-3" onClick={onOpenRef} aria-haspopup="dialog">
            {t('openRef')}
          </Button>
          {/* 사용자 사전은 Yale→한글 전용 (2026-10). 헤더가 여러 줄로 늘어나지 않게 짧은 이름, 좁은 화면에서는 아이콘만 */}
          {direction === 'y2h' && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 px-2 sm:gap-1.5 sm:px-3"
              onClick={onOpenDict}
              aria-haspopup="dialog"
              aria-label={t('openDict')}
              title={t('openDict')}
            >
              <BookAIcon className="sm:hidden" />
              <span className="hidden sm:inline">{t('openDictShort')}</span>
              {dictCount > 0 && (
                <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">{dictCount}</span>
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggle}
            aria-pressed={theme === 'dark'}
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === 'light' ? <SunIcon /> : <MoonIcon />}
          </Button>
          <Button variant="ghost" size="sm" className="px-2 sm:px-3" onClick={toggleLang}>
            {t('langToggle')}
          </Button>
          <a
            className="inline-flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href="https://github.com/kr-jp/hangul_to_yale_romanizer"
            target="_blank"
            rel="noopener"
            aria-label="GitHub repository"
            title="GitHub"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.18-.02-2.14-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18.91-.25 1.89-.38 2.86-.39.97.01 1.95.14 2.86.39 2.18-1.49 3.14-1.18 3.14-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.05.78 2.12 0 1.53-.01 2.77-.01 3.14 0 .31.21.67.8.55C20.71 21.39 24 17.07 24 12 24 5.65 18.85.5 12 .5z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
