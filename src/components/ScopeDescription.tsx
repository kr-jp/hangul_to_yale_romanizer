// 사전 규칙 범위(구간 일치/전체 일치)의 뜻 (2026-10)
// 키가 있으면 그 키를 넣어 원문의 어디가 바뀌는지 보여 주고({k} = 키, {x} = 그 키로 시작하는 더 긴 표기의 예),
// 없으면 일반 문장. 단어 창의 규칙 미리보기와 사전 드로어의 추가 칸에서 쓴다
import { Fragment } from 'react';
import { useI18n } from '@/hooks/useI18n';
import type { DictScope } from '@/lib/types';

export default function ScopeDescription({ scope, keys }: { scope: DictScope; keys: readonly string[] }) {
  const { t } = useI18n();
  const className = 'text-[11px] leading-snug text-muted-foreground';
  if (!keys.length) {
    return <p className={className}>{t(scope === 'segment' ? 'dictScopeSegmentDesc' : 'dictScopeWholeDesc')}</p>;
  }
  const fills: Record<string, string> = { '{k}': keys.join(', '), '{x}': `${keys[0]}-…` };
  const parts = t(scope === 'segment' ? 'editRuleSegmentDesc' : 'editRuleWholeDesc').split(/(\{[kx]\})/);
  return (
    <p className={className}>
      {parts.map((part, i) =>
        fills[part] ? (
          <span key={i} className="font-mono text-foreground">
            {fills[part]}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  );
}
