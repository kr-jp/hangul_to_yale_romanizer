// 옵션 행 — 스위치 5종 + 구분자 컨트롤 (설계 문서 §1, Stage 5 §2.1)
// sepEnabled 스위치는 y2h에서 숨김. SeparatorControls는 h2y && sepEnabled일 때만 표시 (§4.10, §4.12)
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import SeparatorControls from './SeparatorControls';
import { useI18n } from '@/hooks/useI18n';
import type { Direction } from '@/lib/types';

type OptionPatch = Partial<{
  labial: boolean;
  interlinear: boolean;
  numbered: boolean;
  sepEnabled: boolean;
  sepChar: string;
  glossEnabled: boolean;
  tabCopy: boolean;
}>;

interface OptionRowProps {
  direction: Direction;
  labial: boolean;
  interlinear: boolean;
  numbered: boolean;
  sepEnabled: boolean;
  sepChar: string;
  glossEnabled: boolean;
  tabCopy: boolean;
  onChange(patch: OptionPatch): void;
}

export default function OptionRow({
  direction,
  labial,
  interlinear,
  numbered,
  sepEnabled,
  sepChar,
  glossEnabled,
  tabCopy,
  onChange,
}: OptionRowProps) {
  const { t } = useI18n();

  const showSep = direction === 'h2y';

  return (
    <div className="space-y-3">
      {/* L4: 모바일은 2칼럼 그리드로 정렬(ja의 ragged 래핑 해소). 균등 칼럼은 긴 라벨이 꺾여 content 폭 칼럼 사용 */}
      <div className="grid grid-cols-[auto_auto] items-center justify-start gap-x-3 gap-y-3 md:flex md:flex-wrap md:gap-x-6">
        <div className="flex items-center gap-2">
          <Switch id="optLabial" checked={labial} onCheckedChange={(v) => onChange({ labial: v })} />
          <Label htmlFor="optLabial" className="cursor-pointer">
            {t('labelLabial')}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="optInterlinear"
            checked={interlinear}
            onCheckedChange={(v) => onChange({ interlinear: v })}
          />
          <Label htmlFor="optInterlinear" className="cursor-pointer">
            {t('labelInterlinear')}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="optNumbered" checked={numbered} onCheckedChange={(v) => onChange({ numbered: v })} />
          <Label htmlFor="optNumbered" className="cursor-pointer">
            {t('labelExampleNum')}
          </Label>
        </div>
        {/* 글로스 편집 스위치 — 양방향 표시, interlinear와 독립 (Stage 5 §2.1) */}
        <div className="flex items-center gap-2">
          <Switch
            id="optGloss"
            checked={glossEnabled}
            onCheckedChange={(v) => onChange({ glossEnabled: v })}
          />
          <Label htmlFor="optGloss" className="cursor-pointer">
            {t('labelGloss')}
          </Label>
        </div>
        {/* タブ区切り — 복사 시 공백→탭 치환 (기본 ON). OFF면 공백 유지. 영속화 (2026-06-12) */}
        <div className="flex items-center gap-2">
          <Switch id="optTabCopy" checked={tabCopy} onCheckedChange={(v) => onChange({ tabCopy: v })} />
          <Label htmlFor="optTabCopy" className="cursor-pointer">
            {t('labelTabCopy')}
          </Label>
        </div>
        {showSep && (
          <div className="flex items-center gap-2">
            <Switch
              id="optSepEnable"
              checked={sepEnabled}
              onCheckedChange={(v) => onChange({ sepEnabled: v })}
            />
            <Label htmlFor="optSepEnable" className="cursor-pointer">
              {t('labelSep')}
            </Label>
          </div>
        )}
      </div>
      {showSep && sepEnabled && (
        <SeparatorControls sepChar={sepChar} onSepChange={(v) => onChange({ sepChar: v })} />
      )}
    </div>
  );
}
