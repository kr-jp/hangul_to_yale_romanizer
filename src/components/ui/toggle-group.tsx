import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cn } from '@/lib/utils';

function ToggleGroup({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      className={cn('inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5', className)}
      {...props}
    />
  );
}

function ToggleGroupItem({ className, ...props }: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        // H2: 다크에서 bg-card(0.22) vs muted(0.27)는 대비 ~1.3:1로 식별 불가 → 다크 전용 accent 활성 배경
        //     + accent도 휘도 대비는 낮아(색상 차만 확보) 1px inset ring으로 3:1 이상 경계 보장
        'inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm dark:data-[state=on]:bg-accent dark:data-[state=on]:text-accent-foreground dark:data-[state=on]:inset-ring dark:data-[state=on]:inset-ring-ring/80',
        className,
      )}
      {...props}
    />
  );
}

export { ToggleGroup, ToggleGroupItem };
