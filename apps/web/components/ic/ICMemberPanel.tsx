'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { api, type ApiResponse } from '@/lib/api';
import {
  IC_TYPE_LABELS,
  icProgressPercent,
  type MemberICResponse,
} from '@/lib/ic';
import { invalidateICQueries } from '@/lib/queryInvalidation';
import { cn } from '@/lib/utils';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';

type Props = {
  userId: string;
  groupId: string;
  canEdit?: boolean;
};

export function ICMemberPanel({ userId, groupId, canEdit = false }: Props) {
  const queryClient = useQueryClient();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<MemberICResponse>({
    queryKey: ['ic-member', userId, groupId],
    queryFn: async () => {
      const params = new URLSearchParams({ groupId });
      return (await api.get<ApiResponse<MemberICResponse>>(`/ic/member/${userId}?${params}`)).data.data;
    },
    enabled: !!userId && !!groupId,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ indikatorId, isAchieved }: { indikatorId: string; isAchieved: boolean }) => {
      await api.put(`/ic/member/${userId}/progress`, { groupId, indikatorId, isAchieved });
    },
    onSuccess: async () => {
      await invalidateICQueries(queryClient);
    },
  });

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  if (isLoading) return <LoadingSkeleton className="h-32 rounded-xl" />;

  if (!data) return null;

  const { summary, categories } = data;
  const percent = icProgressPercent(summary.achieved, summary.total);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Indikator capaian
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-2xl font-semibold tabular-nums">
              {summary.achieved}
              <span className="text-base font-normal text-muted-foreground">/{summary.total}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Primer {summary.primerAchieved}/{summary.primerTotal} · Sekunder{' '}
              {summary.sekunderAchieved}/{summary.sekunderTotal}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums">{percent}%</p>
            <p className="text-xs text-muted-foreground">tercapai</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {categories.map(({ category, label, types }) => {
          const catAchieved = types.reduce(
            (acc, t) => acc + t.items.filter((i) => i.isAchieved).length,
            0,
          );
          const catTotal = types.reduce((acc, t) => acc + t.items.length, 0);
          const isExpanded = expandedCategories.has(category);

          return (
            <div key={category} className="overflow-hidden rounded-xl border border-border/60">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/30"
                onClick={() => toggleCategory(category)}
              >
                <div className="flex min-w-0 items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-medium">{label}</span>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {catAchieved}/{catTotal}
                </span>
              </button>

              {isExpanded && (
                <div className="border-t border-border/60 bg-muted/10">
                  {types.map(({ type, label: typeLabel, items }) => (
                    <div key={type}>
                      <p className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {typeLabel}
                      </p>
                      <ul className="divide-y divide-border/40">
                        {items.map((item) => (
                          <li key={item.id} className="flex items-start gap-3 px-4 py-3">
                            {canEdit ? (
                              <Button
                                type="button"
                                size="icon"
                                variant={item.isAchieved ? 'default' : 'outline'}
                                className={cn(
                                  'mt-0.5 h-6 w-6 shrink-0 rounded-md',
                                  item.isAchieved && 'bg-primary',
                                )}
                                disabled={toggleMutation.isPending}
                                onClick={() =>
                                  toggleMutation.mutate({
                                    indikatorId: item.id,
                                    isAchieved: !item.isAchieved,
                                  })
                                }
                                aria-label={item.isAchieved ? 'Tandai belum tercapai' : 'Tandai tercapai'}
                              >
                                {item.isAchieved && <Check className="h-3.5 w-3.5" />}
                              </Button>
                            ) : (
                              <span
                                className={cn(
                                  'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border',
                                  item.isAchieved
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border bg-background',
                                )}
                              >
                                {item.isAchieved && <Check className="h-3.5 w-3.5" />}
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className={cn('text-sm', item.isAchieved && 'text-foreground')}>
                                <span className="mr-1.5 text-muted-foreground">#{item.number}</span>
                                {item.title}
                              </p>
                              {item.materi && (
                                <p className="mt-0.5 whitespace-pre-line text-xs text-muted-foreground">
                                  {item.materi}
                                </p>
                              )}
                              {item.isAchieved && item.checkedAt && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Dicentang{item.checkedByName ? ` oleh ${item.checkedByName}` : ''}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
