// 사용자 사전 드로어 (2026-10) — 저장된 항목의 확인·검색·추가·삭제, 이번 세션 항목의 저장, 파일 내보내기/가져오기
// '모두 지우기'는 히스토리와 같은 2단계 확인 (한 번 누르면 확인 문구로 바뀌고, 4초 안에 다시 눌러야 삭제)
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { XIcon } from 'lucide-react';
import { Sheet, SheetCloseButton, SheetContent, SheetHeader, SheetTitle } from './ui/sheet';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import ScopeDescription from './ScopeDescription';
import { useI18n } from '@/hooks/useI18n';
import {
  dictFromJSON,
  dictSize,
  entriesOf,
  isValidKey,
  isValidValue,
  normalizeKey,
  normalizeValue,
} from '@/lib/user-dict';
import type { DictEntry, DictScope, UserDict } from '@/lib/types';

export interface DictionaryDrawerProps {
  open: boolean;
  onOpenChange(o: boolean): void;
  userDict: UserDict;
  sessionDict: UserDict; // 이번 세션에만 적용 중인 항목 (저장 안 함으로 고친 것·공유 URL로 받은 것)
  onAdd(entry: DictEntry): void;
  onRemove(entry: { scope: DictScope; key: string }): void;
  onSaveSession(entries: DictEntry[]): void;
  onClear(): void;
  onImport(dict: UserDict): void;
  onExport(): void;
}

export default function DictionaryDrawer({
  open,
  onOpenChange,
  userDict,
  sessionDict,
  onAdd,
  onRemove,
  onSaveSession,
  onClear,
  onImport,
  onExport,
}: DictionaryDrawerProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [yale, setYale] = useState('');
  const [hangul, setHangul] = useState('');
  const [scopeChoice, setScopeChoice] = useState<DictScope>('segment');
  const [error, setError] = useState<'yale' | 'hangul' | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const confirmTimer = useRef<number | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setConfirmClear(false);
    setError(null);
  }, [open]);
  useEffect(() => () => window.clearTimeout(confirmTimer.current), []);

  const entries = entriesOf(userDict);
  const sessionEntries = entriesOf(sessionDict);
  const q = query.trim().toLowerCase();
  const filtered = q ? entries.filter((e) => e.key.includes(q) || e.value.toLowerCase().includes(q)) : entries;
  const total = entries.length + sessionEntries.length;

  // 키 안에 '-'·'.'가 있으면 구간 하나가 아니므로 전체 일치만
  const typedKey = normalizeKey(yale);
  const keyHasSeparator = /[.-]/.test(typedKey);
  const addScope: DictScope = keyHasSeparator ? 'whole' : scopeChoice;

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const key = typedKey;
    const scope = addScope;
    const value = normalizeValue(hangul);
    if (!isValidKey(scope, key)) return setError('yale');
    if (!isValidValue(value)) return setError('hangul');
    onAdd({ scope, key, value });
    setYale('');
    setHangul('');
    setError(null);
  };

  const handleClear = () => {
    window.clearTimeout(confirmTimer.current);
    if (!confirmClear) {
      setConfirmClear(true);
      confirmTimer.current = window.setTimeout(() => setConfirmClear(false), 4000);
      return;
    }
    setConfirmClear(false);
    onClear();
    setQuery('');
  };

  // 내보낸 사전 파일, 또는 백업 JSON(userDictionary)을 읽어 저장된 사전에 합친다 (같은 키는 파일 쪽으로)
  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown> | null;
      const dict = dictFromJSON(parsed && 'userDictionary' in parsed ? parsed.userDictionary : parsed);
      if (!dictSize(dict)) throw new Error('no entries');
      onImport(dict);
    } catch {
      toast(t('dictImportFailed'), { duration: 3000 });
    }
  };

  const scopeLabel = (scope: DictScope) => t(scope === 'whole' ? 'dictScopeWhole' : 'dictScopeSegment');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{t('ttlDict')}</SheetTitle>
          <div className="flex items-center gap-1">
            {total > 0 && (
              <Button variant={confirmClear ? 'destructive' : 'ghost'} size="sm" onClick={handleClear}>
                {confirmClear ? t('confirmClearHist') : t('dictClear')}
              </Button>
            )}
            <SheetCloseButton aria-label={t('closeDict')} />
          </div>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
          <p className="text-xs leading-relaxed text-muted-foreground">{t('dictIntro')}</p>

          <form onSubmit={handleAdd} className="space-y-2 rounded-lg border border-border p-3">
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={yale}
                onChange={(e) => {
                  setYale(e.target.value);
                  setError(null);
                }}
                placeholder={t('dictYalePlaceholder')}
                aria-label="Yale"
                aria-invalid={error === 'yale' || undefined}
                spellCheck={false}
                autoComplete="off"
                className="font-mono"
              />
              <Input
                value={hangul}
                onChange={(e) => {
                  setHangul(e.target.value);
                  setError(null);
                }}
                placeholder={t('dictHangulPlaceholder')}
                aria-label={t('dictHangulPlaceholder')}
                aria-invalid={error === 'hangul' || undefined}
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <ToggleGroup
                type="single"
                value={addScope}
                onValueChange={(v) => v && setScopeChoice(v as DictScope)}
                aria-label={t('dictScopeLabel')}
              >
                <ToggleGroupItem value="segment" disabled={keyHasSeparator} className="h-7 px-2.5 text-xs">
                  {t('dictScopeSegment')}
                </ToggleGroupItem>
                <ToggleGroupItem value="whole" className="h-7 px-2.5 text-xs">
                  {t('dictScopeWhole')}
                </ToggleGroupItem>
              </ToggleGroup>
              <Button type="submit" size="sm">
                {t('dictAdd')}
              </Button>
            </div>
            <ScopeDescription scope={addScope} keys={isValidKey(addScope, typedKey) ? [typedKey] : []} />
            {error && (
              <p className="text-xs text-destructive">{t(error === 'yale' ? 'dictInvalidYale' : 'dictInvalidHangul')}</p>
            )}
          </form>

          {sessionEntries.length > 0 && (
            <section className="space-y-2 rounded-lg border border-dashed border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-medium text-muted-foreground">{t('dictSession')}</h3>
                <Button variant="outline" size="sm" onClick={() => onSaveSession(sessionEntries)}>
                  {t('dictSaveAll')}
                </Button>
              </div>
              <ul className="space-y-1">
                {sessionEntries.map((e) => (
                  <EntryRow key={`${e.scope}:${e.key}`} entry={e} scopeLabel={scopeLabel(e.scope)} onRemove={() => onRemove(e)}>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onSaveSession([e])}>
                      {t('dictSave')}
                    </Button>
                  </EntryRow>
                ))}
              </ul>
            </section>
          )}

          {entries.length > 0 && (
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('dictSearchPlaceholder')}
              aria-label={t('dictSearchPlaceholder')}
            />
          )}
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dictEmpty')}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dictNoMatch')}</p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((e) => (
                <EntryRow key={`${e.scope}:${e.key}`} entry={e} scopeLabel={scopeLabel(e.scope)} onRemove={() => onRemove(e)} />
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            {t('dictImport')}
          </Button>
          <Button variant="outline" size="sm" onClick={onExport} disabled={entries.length === 0}>
            {t('dictExport')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = ''; // 같은 파일을 다시 고를 수 있게
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EntryRow({
  entry,
  scopeLabel,
  onRemove,
  children,
}: {
  entry: DictEntry;
  scopeLabel: string;
  onRemove(): void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <li className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/60">
      <span className="font-mono">{entry.key}</span>
      <span aria-hidden className="text-muted-foreground">→</span>
      <span className="font-sans">{entry.value}</span>
      <Badge variant="outline" className="ml-auto">
        {scopeLabel}
      </Badge>
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${t('dictDelete')}: ${entry.key}`}
        title={t('dictDelete')}
        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <XIcon className="size-3.5" />
      </button>
    </li>
  );
}
