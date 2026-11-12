import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        // 모바일은 16px — iOS Safari는 16px 미만 입력란에 포커스하면 화면을 확대한다
        'flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-base shadow-sm md:text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
