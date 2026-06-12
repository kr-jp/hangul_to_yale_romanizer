// 자모 참조 드로어 — dom.js buildRefTable의 1:1 이식 (설계 문서 §4.9)
// 섹션 타이틀은 하드코딩 유지 (§6). 표 내용은 useMemo 1회 생성
import { useMemo } from 'react';
import { CHOSEONG, JUNGSEONG, JONGSEONG, J2Y, DOUBLE_CODA_SPLIT } from '@/converter/hangul.js';
import { useI18n } from '@/hooks/useI18n';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetCloseButton } from './ui/sheet';

export interface RefDrawerProps {
  open: boolean;
  onOpenChange(o: boolean): void;
}

// JSON 리터럴 타입에는 인덱스 시그니처가 없으므로 경계에서 Record 뷰로 감싼다 (원본 수정 금지)
const j2y: Record<string, string> = J2Y;
const doubleCodaSplit: Record<string, string> = DOUBLE_CODA_SPLIT;

type Entry = [string, string];

interface Section {
  title: string;
  entries: Entry[];
}

export default function RefDrawer({ open, onOpenChange }: RefDrawerProps) {
  const { t } = useI18n();

  const sections = useMemo<Section[]>(() => {
    // 초성: ㅇ은 Yale 표기상 묵음 → ∅
    const onsetEntries: Entry[] = CHOSEONG.map((j) => [j, j === 'ㅇ' ? '∅' : j2y[j] || '—']);
    const nucleusEntries: Entry[] = JUNGSEONG.map((j) => [j, j2y[j] || '—']);
    // 종성: [0]은 빈 종성 → filter(Boolean). 겹받침은 분해 자모의 Yale을 이어붙임 ('ㄳ'→'ks')
    const codaEntries: Entry[] = JONGSEONG.filter(Boolean).map((j) => {
      const split = doubleCodaSplit[j];
      if (split) return [j, Array.from(split).map((c) => j2y[c] || '?').join('')];
      return [j, j2y[j] || '—'];
    });
    return [
      { title: '초성 (onset)', entries: onsetEntries },
      { title: '중성 (nucleus)', entries: nucleusEntries },
      { title: '종성 (coda)', entries: codaEntries },
    ];
  }, []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{t('ttlRef')}</SheetTitle>
          <SheetCloseButton aria-label={t('closeRef')} />
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {sections.map((section) => (
            <div key={section.title}>
              <div className="mb-2 text-sm font-semibold">{section.title}</div>
              <div className="grid grid-cols-5 gap-1.5">
                {section.entries.map(([j, y]) => (
                  <div
                    key={j}
                    title={`${j} → ${y}`}
                    className="flex flex-col items-center rounded-md border border-border bg-card px-2 py-1.5"
                  >
                    <span className="text-[15px] leading-tight">{j}</span>
                    <small className="font-mono text-xs text-muted-foreground">{y}</small>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-sm text-muted-foreground">{t('refNote')}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
