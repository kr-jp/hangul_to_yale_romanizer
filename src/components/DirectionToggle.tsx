// 변환 방향 토글 — 라벨 하드코딩 유지 (설계 문서 §6), 활성 버튼 재클릭(빈 value)은 무시
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import type { Direction } from '@/lib/types';

interface DirectionToggleProps {
  value: Direction;
  onChange(d: Direction): void;
}

export default function DirectionToggle({ value, onChange }: DirectionToggleProps) {
  return (
    // M4: 모바일에서 토글이 헤더 내 풀폭 단독 행이 되도록 (stage0 패턴)
    <ToggleGroup
      className="max-md:w-full"
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v === 'h2y' || v === 'y2h') onChange(v);
      }}
      aria-label="Conversion direction"
    >
      <ToggleGroupItem value="h2y" className="max-md:flex-1">
        한글 → Yale
      </ToggleGroupItem>
      <ToggleGroupItem value="y2h" className="max-md:flex-1">
        Yale → 한글
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
