// y2h 인터리니어 아랫줄의 어절 1개 — 클릭하면 후보 선택·직접 입력, 기억할 규칙의 미리보기와 범위 선택,
// 사용자 사전 항목 삭제 (2026-10)
// 표시: 모호어(후보 2개 이상)는 점선 밑줄, 사전 항목이 쓰인 어절·예전 공유 URL의 선택은 실선 밑줄,
// 그 밖의 어절은 마우스를 올렸을 때만 밑줄. 클릭이 카드 복사로 버블되지 않게 막는다 (§4.4)
import { useId, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react';
import { XIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { useI18n } from '@/hooks/useI18n';
import { cn } from '@/lib/utils';
import { readDictRemember, writeDictRemember } from '@/lib/storage';
import { candidateText, isValidValue, normalizeValue } from '@/lib/user-dict';
import type { CorrectionPlan, DictChange, DictEntry, DictScope, WordEditor, YaleCandidate } from '@/lib/types';

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
        className="w-80 max-w-[calc(100vw-2rem)] p-0"
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

// 열릴 때마다 새로 마운트 — 입력 칸 초기값·적용 중인 사전 항목을 그 시점의 상태로 계산.
// 후보를 누르면 입력 칸에 들어가고(바로 적용하지 않음), 아래에 기억할 규칙과 범위가 표시된다.
// 적용(Enter)으로 저장. 후보를 더블클릭하면 그 후보를 바로 적용
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
  const [scopeChoice, setScopeChoice] = useState<DictScope | null>(null);
  const [invalid, setInvalid] = useState(false);
  const plan = useMemo(() => (info ? editor.plan(token, text) : null), [info, editor, token, text]);
  const scope = scopeOf(plan, scopeChoice);
  const change = changeOf(plan, scope);

  const commit = (c: DictChange | null) => {
    if (c) editor.apply(c, remember);
    onDone();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isValidValue(normalizeValue(text))) {
      setInvalid(true);
      return;
    }
    commit(change);
  };

  return (
    <div className="text-sm">
      {info && (
        <div className="border-b border-border px-3 py-1.5 font-mono text-xs text-muted-foreground">{info.yale}</div>
      )}
      {candidates.length > 0 && (
        <div className="max-h-56 overflow-auto p-1">
          {candidates.map((c, i) => {
            const current = c.hangul === selected; // 지금 출력에 쓰인 후보
            const inInput = !!info && (candidateText(c) === text || c.hangul === text); // 입력 칸에 들어 있는 후보
            return (
              <button
                key={`${i}-${c.hangul}`}
                type="button"
                title={t('editPickHint')}
                onClick={(e) => {
                  e.stopPropagation();
                  setText(candidateText(c));
                  setInvalid(false);
                  inputRef.current?.focus();
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  const p = editor.plan(token, candidateText(c));
                  commit(changeOf(p, scopeOf(p, scopeChoice)));
                }}
                className={cn(
                  // H1 동일 원칙: 후보는 한글이므로 sans
                  'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left font-sans text-sm hover:bg-muted',
                  inInput && 'bg-accent font-semibold text-accent-foreground',
                )}
              >
                {current && <span aria-hidden className="text-xs text-primary">✓</span>}
                <span>{c.hangul}</span>
                {/* 첫 번째(best) 강조 — 지금 출력과 겹치면 ✓만 */}
                {i === 0 && !current && <span aria-hidden className="ml-auto text-[11px] text-primary">★</span>}
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
          <RulePreview plan={plan} scope={scope} hits={info.hits} onScope={setScopeChoice} />
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
                {t(h.scope === 'whole' ? 'dictScopeWhole' : 'dictScopeSegment')}
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

// 고른 범위가 이 수정에서 가능하면 그것, 아니면 기본 범위
function scopeOf(plan: CorrectionPlan | null, choice: DictScope | null): DictScope {
  if (plan?.kind === 'rule' && choice && plan[choice]) return choice;
  return plan?.defaultScope ?? 'whole';
}

function changeOf(plan: CorrectionPlan | null, scope: DictScope): DictChange | null {
  if (!plan) return null;
  if (plan.kind === 'revert') return plan.revert;
  if (plan.kind === 'rule') return plan[scope] ?? plan.whole;
  return null;
}

// 기억할 규칙 미리보기 — 범위(구간 일치/전체 일치)를 고르고, 그 범위로 저장될 규칙과 뜻을 보여 준다
function RulePreview({
  plan,
  scope,
  hits,
  onScope,
}: {
  plan: CorrectionPlan | null;
  scope: DictScope;
  hits: DictEntry[];
  onScope(scope: DictScope): void;
}) {
  const { t } = useI18n();
  if (!plan || plan.kind === 'none') {
    return <p className="text-[11px] leading-snug text-muted-foreground">{t('editRuleNone')}</p>;
  }
  if (plan.kind === 'revert') {
    return (
      <div className="space-y-1 rounded-md bg-muted/60 px-2.5 py-2 text-xs">
        <p className="font-medium">{t('editRuleRevert')}</p>
        <RuleLines entries={hits} />
      </div>
    );
  }
  const change = plan[scope] ?? plan.whole;
  if (!change) return null;
  const note =
    scope === 'whole' && plan.segmentBlocked
      ? t(plan.segmentBlocked === 'unaligned' ? 'editSegmentUnaligned' : 'editSegmentMixed')
      : scope === 'whole' && plan.shortSegment
        ? t('editShortSegment')
        : null;
  return (
    <div className="space-y-1.5 rounded-md bg-muted/60 px-2.5 py-2 text-xs" data-testid="rule-preview">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="font-medium">{t('editRuleTitle')}</span>
        <ToggleGroup
          type="single"
          value={scope}
          onValueChange={(v) => v && onScope(v as DictScope)}
          aria-label={t('dictScopeLabel')}
          className="p-0.5"
        >
          <ToggleGroupItem value="segment" disabled={!plan.segment} className="h-6 px-2 text-xs">
            {t('dictScopeSegment')}
          </ToggleGroupItem>
          <ToggleGroupItem value="whole" className="h-6 px-2 text-xs">
            {t('dictScopeWhole')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <RuleLines entries={change.add} />
      <p className="text-[11px] leading-snug text-muted-foreground">
        {t(scope === 'segment' ? 'dictScopeSegmentDesc' : 'dictScopeWholeDesc')}
      </p>
      {change.remove.length > 0 && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {t('editRuleRemoves')} <span className="font-mono">{change.remove.map((r) => r.key).join(', ')}</span>
        </p>
      )}
      {note && <p className="text-[11px] leading-snug text-muted-foreground">{note}</p>}
    </div>
  );
}

function RuleLines({ entries }: { entries: { key: string; value: string }[] }) {
  return (
    <ul className="space-y-0.5">
      {entries.map((e) => (
        <li key={e.key} className="flex items-baseline gap-1.5">
          <span className="font-mono">{e.key}</span>
          <span aria-hidden className="text-muted-foreground">→</span>
          <span className="font-sans text-sm">{e.value}</span>
        </li>
      ))}
    </ul>
  );
}
