'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { hasMutabaahContent, type MutabaahFormItem } from '@/lib/mutabaah';
import { MutabaahViewer } from '@/components/mutabaah/MutabaahViewer';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { formatWeekRange, toWeekDateParam } from '@/lib/utils';

type Props = {
  userId: string;
  groupId: string;
  weekDate: string;
  userName?: string;
  compact?: boolean;
};

type MemberMutabaahResponse = {
  id?: string | null;
  user: { id: string; name: string };
  isSubmitted: boolean;
  items: MutabaahFormItem[];
};

function MutabaahEmptyState({
  userName,
  weekDate,
  compact,
}: {
  userName?: string;
  weekDate: string;
  compact?: boolean;
}) {
  const title = userName ? `${userName} belum mengisi mutabaah` : 'Belum ada mutabaah';
  const weekLabel = formatWeekRange(weekDate);

  return (
    <div
      className={
        compact
          ? 'rounded-xl border border-dashed border-border/60 px-4 py-5 text-center'
          : 'rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-8 text-center'
      }
    >
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Pekan {weekLabel} belum diisi
      </p>
    </div>
  );
}

export function MutabaahMemberPanel({ userId, groupId, weekDate, userName, compact }: Props) {
  const weekParam = weekDate ? toWeekDateParam(weekDate) : '';

  const { data, isLoading } = useQuery<MemberMutabaahResponse>({
    queryKey: ['mutabaah-member', userId, groupId, weekParam],
    queryFn: async () => {
      const params = new URLSearchParams({ groupId, weekDate: weekParam });
      return (
        await api.get<ApiResponse<MemberMutabaahResponse>>(
          `/mutabaah/member/${userId}?${params}`,
        )
      ).data.data;
    },
    enabled: !!userId && !!groupId && !!weekParam,
  });

  if (isLoading) return <LoadingSkeleton className={compact ? 'h-16 rounded-xl' : 'h-24 rounded-xl'} />;

  const hasContent = data?.items?.length ? hasMutabaahContent(data.items) : false;
  const showEmpty = !data?.isSubmitted && (!data?.id || !hasContent);

  if (showEmpty) {
    return <MutabaahEmptyState userName={userName} weekDate={weekParam} compact={compact} />;
  }

  return (
    <div className="space-y-2">
      {!compact && (
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Mutabaah yaumiyah {data!.isSubmitted ? '· terkirim' : '· draft'} · pekan{' '}
          {formatWeekRange(weekParam)}
        </p>
      )}
      {compact && (
        <p className="text-xs text-muted-foreground">
          Pekan {formatWeekRange(weekParam)}
          {data!.isSubmitted ? ' · terkirim' : ' · draft'}
        </p>
      )}
      <MutabaahViewer items={data!.items ?? []} />
    </div>
  );
}
