// y2h 인터리니어 아랫줄의 어절 1개 — 클릭하면 후보 선택·직접 입력·사용자 사전 항목 삭제 (2026-10)
// 표시: 모호어(후보 2개 이상)는 점선 밑줄, 사전 항목이 쓰인 어절·예전 공유 URL의 선택은 실선 밑줄,
// 그 밖의 어절은 마우스를 올렸을 때만 밑줄. 클릭이 카드 복사로 버블되지 않게 막는다 (§4.4)
import { useId, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react';
import { XIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';
import { readDictRemember, writeDictRemember } from '@/lib/storage';
import { isValidValue, normalizeValue } from '@/lib/user-dict';
import type { WordEditor, YaleCandidate } from '@/lib/types';

interface WordPopoverProps {
  token: string; // 원문(Yale) 토큰
  roma: string; // 표시 중인 변환 결과
  candidates: YaleCandidate[];
  selected: string | undefined; // 현재 선택값 — 예전 공유 URL의 선택(override) 우선, 아니면 best
  edited: boolean; // 예전 공유 URL의 선택이 적용됨
  editable: boolean; // 직접 입력 가능 (Yale run이 1개인 토큰)
  editor: WordEditor;
}

export default function WordPopover({ token, roma, candidates, selected, edited, editable, editor }: WordPopoverProps) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const ambiguous = candidates.length > 1;
  const fromDict = !!candidates[0]?.dict;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'cursor-pointer rounded-xs px-px text-left underline-offset-4 transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            ambiguous ? 'border-b border-dotted border-primary' : 'hover:underline hover:decoration-dotted',
            (fromDict || edited) && 'border-b border-solid border-primary font-medium text-primary',
          )}
        >
          {roma}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 max-w-[calc(100vw-2rem)] p-0"
        // Portal 내부 클릭도 React 트리상 카드로 버블되므로 차단
        onClick={(e) => e.stopPropagation()}
        // 후보 목록이 없으면 바로 고칠 수 있게 입력 칸에 포커스 (있으면 기본대로 첫 후보)
        onOpenAutoFocus={(e) => {
          if (ambiguous || !editable) return;
          e.preventDefault();
          inputRef.current?.focus();
          inputRef.current?.select();
        }}
      >
        <WordPopoverBody
          token={token}
          candidates={ambiguous ? candidates : []}
          selected={selected}
          editable={editable}
          editor={editor}
          inputRef={inputRef}
          onDone={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

// 열릴 때마다 새로 마운트 — 입력 칸 초기값·적용 중인 사전 항목을 그 시점의 상태로 계산
function WordPopoverBody({
  token,
  candidates,
  selected,
  editable,
  editor,
  inputRef,
  onDone,
}: {
  token: string;
  candidates: YaleCandidate[];
  selected: string | undefined;
  editable: boolean;
  editor: WordEditor;
  inputRef: RefObject<HTMLInputElement | null>;
  onDone(): void;
}) {
  const { t } = useI18n();
  const inputId = useId();
  const info = useMemo(() => (editable ? editor.describe(token) : null), [editable, editor, token]);
  const [text, setText] = useState(info?.prefill ?? '');
  const [remember, setRemember] = useState(readDictRemember);
  const [invalid, setInvalid] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const value = normalizeValue(text);
    if (!isValidValue(value)) {
      setInvalid(true);
      return;
    }
    editor.correct(token, value, remember);
    onDone();
  };

  return (
    <div className="text-sm">
      {info && (
        <div className="border-b border-border px-3 py-1.5 font-mono text-xs text-muted-foreground">{info.yale}</div>
      )}
      {candidates.length > 0 && (
        <div className="max-h-56 overflow-auto p-1">
          {candidates.map((c, i) => {
            const isSelected = c.hangul === selected;
            return (
              <button
                key={`${i}-${c.hangul}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  editor.correct(token, c, remember);
                  onDone();
                }}
                className={cn(
                  // H1 동일 원칙: 후보는 한글이므로 sans
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left font-sans text-sm hover:bg-muted',
                  isSelected && 'bg-accent font-semibold text-accent-foreground',
                )}
              >
                {isSelected && <span aria-hidden className="text-xs text-primary">✓</span>}
                <span>{c.hangul}</span>
                {/* 첫 번째(best) 강조 — selected와 겹치면 ✓만 */}
                {i === 0 && !isSelected && <span aria-hidden className="ml-auto text-[11px] text-primary">★</span>}
              </button>
            );
          })}
        </div>
      )}
      {info && (
        <form onSubmit={submit} className={cn('space-y-2 p-3', candidates.length > 0 && 'border-t border-border')}>
          <label htmlFor={inputId} className="block text-xs font-medium text-muted-foreground">
            {t('editLabel')}
          </label>
          <div className="flex gap-1.5">
            <Input
              ref={inputRef}
              id={inputId}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setInvalid(false);
              }}
              placeholder={t('editPlaceholder')}
              aria-invalid={invalid || undefined}
              spellCheck={false}
              autoComplete="off"
              className="h-8 font-sans"
            />
            <Button type="submit" size="sm">
              {t('editApply')}
            </Button>
          </div>
          {invalid && <p className="text-xs text-destructive">{t('editInvalid')}</p>}
          {info.segmented && <p className="text-[11px] leading-snug text-muted-foreground">{t('editHintMorph')}</p>}
          <label className="flex cursor-pointer items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => {
                setRemember(e.target.checked);
                writeDictRemember(e.target.checked);
              }}
              className="size-3.5 accent-primary"
            />
            {t('editRemember')}
          </label>
        </form>
      )}
      {info && info.hits.length > 0 && (
        <div className="space-y-1 border-t border-border px-3 py-2">
          <p className="text-[11px] text-muted-foreground">{t('editFromDict')}</p>
          {info.hits.map((h) => (
            <div key={`${h.scope}:${h.key}`} className="flex items-center gap-1.5 text-xs">
              <span className="font-mono">{h.key}</span>
              <span aria-hidden className="text-muted-foreground">→</span>
              <span className="font-sans">{h.value}</span>
              <Badge variant="outline" className="ml-auto">
                {t(h.scope === 'words' ? 'dictScopeWords' : 'dictScopeMorphemes')}
              </Badge>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  editor.remove(h);
                  onDone();
                }}
                aria-label={`${t('editRemoveEntry')}: ${h.key}`}
                title={t('editRemoveEntry')}
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
