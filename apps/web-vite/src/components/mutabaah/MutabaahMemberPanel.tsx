import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import {
  emptyValueForItem,
  hasMutabaahContent,
  type MutabaahAnswerValue,
  type MutabaahFormItem,
} from '@/lib/mutabaah';
import { MutabaahEntryForm } from '@/components/mutabaah/MutabaahEntryForm';
import { MutabaahViewer } from '@/components/mutabaah/MutabaahViewer';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { formatWeekRange, toWeekDateParam } from '@/lib/utils';
import { invalidateMutabaahQueries } from '@/lib/queryInvalidation';
import { toastError, toastSuccess } from '@/lib/toast';

type Props = {
  userId: string;
  groupId: string;
  weekDate: string;
  userName?: string;
  compact?: boolean;
  canEdit?: boolean;
};

type MemberMutabaahResponse = {
  id?: string | null;
  user?: { id: string; name: string };
  isSubmitted: boolean;
  items: MutabaahFormItem[];
};

function normalizeItems(items: MutabaahFormItem[] | null | undefined): MutabaahFormItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => ({
    ...item,
    value: item?.value ?? emptyValueForItem(item),
  }));
}

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
      <p className="mt-1 text-sm text-muted-foreground">Pekan {weekLabel} belum diisi</p>
    </div>
  );
}

export function MutabaahMemberPanel({
  userId,
  groupId,
  weekDate,
  userName,
  compact,
  canEdit = false,
}: Props) {
  const queryClient = useQueryClient();
  const weekParam = weekDate ? toWeekDateParam(weekDate) : '';
  const [answers, setAnswers] = useState<Record<string, MutabaahAnswerValue>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data, isLoading, refetch } = useQuery<MemberMutabaahResponse>({
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

  const items = normalizeItems(data?.items);

  useEffect(() => {
    if (!data?.items) return;
    const next: Record<string, MutabaahAnswerValue> = {};
    for (const item of normalizeItems(data.items)) {
      next[item.id] = item.value ?? emptyValueForItem(item);
    }
    setAnswers(next);
    setError('');
  }, [data?.items, data?.id, data?.isSubmitted, weekParam, userId, groupId]);

  const save = async (submit: boolean) => {
    try {
      setLoading(true);
      setError('');
      const payload = {
        groupId,
        weekDate: weekParam,
        answers: items.map((item) => ({
          itemId: item.id,
          value: answers[item.id] ?? item.value ?? emptyValueForItem(item),
        })),
      };
      if (submit) {
        await api.post(`/mutabaah/member/${userId}/submit`, payload);
        toastSuccess('Mutabaah berhasil dikirim');
      } else {
        await api.put(`/mutabaah/member/${userId}`, payload);
        toastSuccess('Berhasil disimpan');
      }
      await invalidateMutabaahQueries(queryClient);
      await refetch();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal menyimpan mutabaah',
      );
      toastError(err, 'Gagal menyimpan');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <LoadingSkeleton className={compact ? 'h-16 rounded-xl' : 'h-24 rounded-xl'} />;

  const isSubmitted = data?.isSubmitted ?? false;
  const hasContent = items.length ? hasMutabaahContent(items) : false;
  const showEditor = canEdit && !isSubmitted;
  const showEmpty = !showEditor && !isSubmitted && (!data?.id || !hasContent);

  if (showEditor) {
    return (
      <MutabaahEntryForm
        items={items}
        answers={answers}
        onChange={(itemId, value) => setAnswers((prev) => ({ ...prev, [itemId]: value }))}
        loading={loading}
        error={error}
        compact={compact}
        helperText={
          userName
            ? `Isi mutabaah atas nama ${userName}. Poin +2 tetap masuk ke anggota saat dikirim.`
            : 'Isi mutabaah atas nama anggota. Poin +2 tetap masuk ke anggota saat dikirim.'
        }
        onSaveDraft={() => void save(false)}
        onSubmit={() => void save(true)}
      />
    );
  }

  if (showEmpty) {
    return <MutabaahEmptyState userName={userName} weekDate={weekParam} compact={compact} />;
  }

  return (
    <div className="space-y-2">
      {!compact && (
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Mutabaah yaumiyah {isSubmitted ? '· terkirim' : '· draft'} · pekan{' '}
          {formatWeekRange(weekParam)}
        </p>
      )}
      {compact && (
        <p className="text-xs text-muted-foreground">
          Pekan {formatWeekRange(weekParam)}
          {isSubmitted ? ' · terkirim' : ' · draft'}
        </p>
      )}
      <MutabaahViewer items={items} />
    </div>
  );
}
