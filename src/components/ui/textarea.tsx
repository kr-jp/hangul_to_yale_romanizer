import * as React from 'react';
import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        // ring-inset: 입출력 패널의 리사이즈 래퍼(overflow-hidden)에서 포커스 링이 잘리지 않도록 안쪽으로 그림
        // 모바일은 16px — iOS Safari는 16px 미만 입력란에 포커스하면 화면을 확대한다
        'w-full rounded-lg border border-input bg-card px-3 py-2.5 text-base leading-relaxed md:text-[15px] shadow-sm ring-inset transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
