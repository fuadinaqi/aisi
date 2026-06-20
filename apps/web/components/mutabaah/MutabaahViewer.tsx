'use client';

import { DAY_LABELS, getDailyDays, type MutabaahFormItem } from '@/lib/mutabaah';
import { cn } from '@/lib/utils';

type Props = {
  items: MutabaahFormItem[];
  emptyMessage?: string;
};

function DailyValueGrid({ item }: { item: MutabaahFormItem }) {
  const days = getDailyDays(item, item.value);
  const isNumber = item.fieldType === 'NUMBER';

  return (
    <div className="mt-2.5 grid grid-cols-7 gap-1">
      {DAY_LABELS.map((label, index) => {
        const raw = days[index];
        const display = isNumber ? String(Number(raw) || 0) : raw ? '✓' : '—';

        return (
          <div key={label} className="min-w-0 text-center">
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">{label}</p>
            <div
              className={cn(
                'flex h-8 items-center justify-center rounded-md border bg-muted/30 px-0.5 text-xs tabular-nums',
                !isNumber && raw && 'border-primary/30 bg-primary/5 font-medium text-primary',
              )}
            >
              {display}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DailySummary({ item }: { item: MutabaahFormItem }) {
  const days = getDailyDays(item, item.value);

  if (item.fieldType === 'NUMBER') {
    const total = days.reduce((sum, d) => sum + (Number(d) || 0), 0);
    return <span className="shrink-0 text-sm font-medium tabular-nums">{total}</span>;
  }

  const count = days.filter(Boolean).length;
  return <span className="shrink-0 text-sm font-medium tabular-nums">{count}/7</span>;
}

export function MutabaahViewer({ items, emptyMessage = 'Belum ada mutabaah pekan ini' }: Props) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="divide-y divide-border/60">
      {items.map((item) => {
        const isDaily = item.inputScope === 'DAILY';

        if (isDaily) {
          return (
            <div key={item.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-snug">{item.title}</p>
                  {item.target && (
                    <p className="mt-0.5 text-xs text-muted-foreground">Target: {item.target}</p>
                  )}
                </div>
                <DailySummary item={item} />
              </div>
              <DailyValueGrid item={item} />
            </div>
          );
        }

        return (
          <div key={item.id} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">{item.title}</p>
              {item.target && (
                <p className="mt-0.5 text-xs text-muted-foreground">Target: {item.target}</p>
              )}
            </div>
            <p className="shrink-0 text-right text-sm font-medium tabular-nums">
              {item.displayValue || '—'}
            </p>
          </div>
        );
      })}
    </div>
  );
}
