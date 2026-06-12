// 히스토리 드로어 — dom.js renderHistory/renderTagFilter의 1:1 이식 (설계 문서 §4.8)
// 검색어·활성태그는 컴포넌트 로컬 state. Sheet(modal)로 내부 클릭 시 닫힘 버그를 구조적으로 차단
import { useEffect, useState } from 'react';
import { useI18n } from '@/hooks/useI18n';
import { useHistory } from '@/hooks/useHistory';
import HistoryItemCard from './HistoryItemCard';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetCloseButton } from './ui/sheet';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import type { HistoryItem } from '@/lib/types';

export interface HistoryDrawerProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  onRestore(item: HistoryItem): void;
}

export default function HistoryDrawer({ open, onOpenChange, onRestore }: HistoryDrawerProps) {
  const { t } = useI18n();
  const { items, allTags, refresh, togglePin, remove, clear, addTag, removeTag } = useHistory();
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // 열 때마다 localStorage에서 다시 읽기 (디바운스 자동 기록분 반영 — 원본 openHist 시 renderHistory와 동일)
  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  // 검색 부분일치 + 태그 단일 필터 AND 결합 (§4.8)
  const q = query.trim().toLowerCase();
  const filtered = items.filter((h) => {
    if (activeTag && !(h.tags || []).includes(activeTag)) return false;
    if (q && !h.text.toLowerCase().includes(q)) return false;
    return true;
  });

  // 모두 지우기: 히스토리 비우기 + 검색어·활성태그 리셋 (§4.8)
  const handleClear = () => {
    clear();
    setQuery('');
    setActiveTag(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{t('ttlHist')}</SheetTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleClear}>
              {t('clearHist')}
            </Button>
            <SheetCloseButton aria-label={t('closeHist')} />
          </div>
        </SheetHeader>
        <div className="space-y-2 border-b border-border px-4 py-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('histSearchPlaceholder')}
            aria-label={t('histSearchPlaceholder')}
          />
          {allTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTag((prev) => (prev === tag ? null : tag));
                  }}
                  aria-pressed={tag === activeTag}
                  className={cn(
                    'inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    tag === activeTag
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('emptyHist')}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noMatch')}</p>
          ) : (
            filtered.map((item) => (
              <HistoryItemCard
                key={item.id}
                item={item}
                onRestore={() => onRestore(item)}
                onTogglePin={() => togglePin(item.id)}
                onDelete={() => remove(item.id)}
                onAddTag={(tag) => addTag(item.id, tag)}
                onRemoveTag={(tag) => removeTag(item.id, tag)}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
