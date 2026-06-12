// 히스토리 항목 카드 — dom.js renderHistory의 항목 렌더 1:1 이식 (설계 문서 §4.8)
// 배지 순서: 타임스탬프 → PIN → sep: → labial:. 도구 라벨은 하드코딩 유지 (§6)
import { useI18n } from '@/hooks/useI18n';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import type { HistoryItem } from '@/lib/types';

interface HistoryItemCardProps {
  item: HistoryItem;
  onRestore(): void;
  onTogglePin(): void;
  onDelete(): void;
  onAddTag(tag: string): void;
  onRemoveTag(tag: string): void;
}

export default function HistoryItemCard({
  item,
  onRestore,
  onTogglePin,
  onDelete,
  onAddTag,
  onRemoveTag,
}: HistoryItemCardProps) {
  const { t } = useI18n();
  // 원본과 동일: 첫 줄 80자, 말줄임표는 전체 텍스트 길이 기준
  const firstLine = (item.text.split(/\r?\n/)[0] || '').slice(0, 80);
  const body = firstLine + (item.text.length > 80 ? '…' : '');

  // window.prompt 그대로 유지 (1:1 보존). 빈 입력·취소는 무시 (§4.8)
  const handleAddTag = () => {
    const tag = window.prompt(t('addTagPrompt'));
    if (tag) onAddTag(tag);
  };

  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-1">
        <Badge variant="outline">{new Date(item.id).toLocaleString()}</Badge>
        {item.pinned && <Badge>PIN</Badge>}
        <Badge variant="secondary" className="font-mono">{'sep:' + (item.opts.sep || '∅')}</Badge>
        <Badge variant="secondary" className="font-mono">
          {item.opts.labial ? 'labial:on' : 'labial:off'}
        </Badge>
      </div>
      <div className="break-all font-mono text-[15px]">{body}</div>
      <div className="flex flex-wrap items-center gap-1">
        {(item.tags || []).map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-xs text-accent-foreground"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemoveTag(tag);
              }}
              className="rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleAddTag();
          }}
          className="inline-flex items-center rounded-md border border-dashed border-border px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          + tag
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={onRestore}>
          Restore
        </Button>
        <Button variant="outline" size="sm" onClick={onTogglePin}>
          {item.pinned ? 'Unpin' : 'Pin'}
        </Button>
        <Button variant="outline" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
