// 입출력 패널 — 높이 동기화 구조 (설계 문서 §5) + 출력 선택 자동복사 (§4.2) + 입력 파일 DnD (§4.7)
// 리사이즈 핸들은 래퍼 1곳뿐 → 두 패널 높이가 정의상 항상 동일.
// 입력 측 선택 자동복사는 사용자 결정(2026-06-12)으로 제거 — 출력 측만 유지.
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useI18n } from '@/hooks/useI18n';
import { copyText } from '@/lib/clipboard';
import { cn } from '@/lib/utils';
import type { Direction, OutputFormat } from '@/lib/types';

// 파일 DnD 업로드 상한 (원본 dom.js MAX_UPLOAD_BYTES)
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

interface IOPanelsProps {
  direction: Direction;
  input: string;
  onInputChange(v: string): void;
  output: string;
  format: OutputFormat;
  tabCopy: boolean; // タブ区切り — 출력 선택 자동복사의 탭 치환 여부
}

// keyup 자동복사 트리거: Shift 동반 / Arrow* / Cmd·Ctrl+A (원본 dom.js와 동일)
function isSelectionKeyUp(e: React.KeyboardEvent): boolean {
  const key = e.key || '';
  return e.shiftKey || key.startsWith('Arrow') || (key.toLowerCase() === 'a' && (e.metaKey || e.ctrlKey));
}

export default function IOPanels({ direction, input, onInputChange, output, format, tabCopy }: IOPanelsProps) {
  const { t } = useI18n();
  // 원본과 동일하게 입력/출력 공용 타이머 1개 (10ms 디바운스)
  const autoCopyTimer = useRef<number | undefined>(undefined);
  // 파일 드래그오버 시각 피드백 (원본 .dragover 클래스 상당)
  const [dragOver, setDragOver] = useState(false);

  // dragenter/dragover: 파일 드래그일 때만 preventDefault + 스타일 (원본 dom.js와 동일)
  function handleDragOver(e: React.DragEvent<HTMLTextAreaElement>) {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    setDragOver(false);
  }

  // drop: 첫 파일만. 5MB 초과 → fileTooLarge. 확장자·MIME 제한 없음 (§8-4)
  function handleDrop(e: React.DragEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      toast(t('fileTooLarge'), { duration: 2000 });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onInputChange(String(reader.result || ''));
    reader.onerror = () => toast('Read error', { duration: 2000 });
    reader.readAsText(file);
  }

  // 출력 textarea 전용 — Plain + タブ区切り ON일 때만 공백 run → 탭 치환 (개행 제외)
  function autoCopySelected(el: HTMLTextAreaElement) {
    window.clearTimeout(autoCopyTimer.current);
    autoCopyTimer.current = window.setTimeout(() => {
      const s = el.selectionStart;
      const e = el.selectionEnd;
      const sel = e > s ? el.value.slice(s, e) : '';
      if (!sel) return;
      const text = format === 'plain' && tabCopy ? sel.replace(/[^\S\r\n]+/g, '\t') : sel;
      void copyText(text).then(() => toast(t('copied'), { duration: 2000 }));
    }, 10);
  }

  const isY2H = direction === 'y2h';

  return (
    <div>
      {/* 리사이즈 핸들은 이 래퍼 1개에만 — 두 패널 높이 동기화의 구조적 보장 */}
      <div className="h-[260px] max-h-[70vh] min-h-[180px] resize-y overflow-hidden rounded-md md:h-[240px]">
        <div className="grid h-full grid-cols-1 grid-rows-2 gap-4 md:grid-cols-2 md:grid-rows-1">
          <div className="flex min-h-0 flex-col">
            <Label htmlFor="input" className="shrink-0 text-muted-foreground">
              {t(isY2H ? 'labelInputY2H' : 'labelInput')}
            </Label>
            <Textarea
              id="input"
              rows={5}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={t(isY2H ? 'placeholderY2H' : 'placeholderH2Y')}
              spellCheck={false}
              className={cn(
                'mt-1.5 min-h-0 flex-1 resize-none',
                // H1: 한글 텍스트에 mono를 쓰면 공백 폭이 비정상 — 방향별 폰트 분리 (h2y 입력=한글=sans)
                isY2H ? 'font-mono' : 'font-sans',
                dragOver && 'border-ring ring-2 ring-ring/50',
              )}
              onDragEnter={handleDragOver}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            />
          </div>
          <div className="flex min-h-0 flex-col">
            <Label htmlFor="output" className="shrink-0 text-muted-foreground">
              {t(isY2H ? 'labelOutputY2H' : 'labelOutput')}
            </Label>
            <Textarea
              id="output"
              rows={5}
              value={output}
              readOnly
              spellCheck={false}
              className={cn(
                'mt-1.5 min-h-0 flex-1 resize-none bg-muted/40',
                // H1: h2y 출력=Yale=mono(탭 정렬 가치), y2h 출력=한글=sans
                isY2H ? 'font-sans' : 'font-mono',
              )}
              onMouseUp={(e) => autoCopySelected(e.currentTarget)}
              onTouchEnd={(e) => autoCopySelected(e.currentTarget)}
              onKeyUp={(e) => {
                if (isSelectionKeyUp(e)) autoCopySelected(e.currentTarget);
              }}
            />
          </div>
        </div>
      </div>
      {/* y2h 힌트는 래퍼 밖 — 높이 계산에 영향 주지 않음 (§5) */}
      {isY2H && <p className="mt-2 text-xs text-muted-foreground">{t('hintY2H')}</p>}
    </div>
  );
}
