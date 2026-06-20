'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { invalidateMutabaahQueries } from '@/lib/queryInvalidation';
import type { MutabaahAnswerValue, MutabaahFormItem } from '@/lib/mutabaah';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { MutabaahFieldInput, MutabaahFieldLabel } from '@/components/mutabaah/MutabaahFieldInput';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn, formatDate, formatWeekRange, toDateInputValue, toWeekDateParam } from '@/lib/utils';

type MutabaahGroupOption = {
  id: string;
  name: string;
  level: string;
  joinedAt?: string;
  minWeekDate?: string;
};

type MutabaahMyResponse = {
  needsGroupSelection?: boolean;
  groups?: MutabaahGroupOption[];
  group?: { id: string; name: string; level: string };
  weekDate?: string;
  minWeekDate?: string;
  joinedAt?: string;
  id?: string | null;
  isSubmitted?: boolean;
  items?: MutabaahFormItem[];
};

export default function MutabaahPage() {
  const queryClient = useQueryClient();
  const todayMax = toDateInputValue();
  const [weekDate, setWeekDate] = useState(todayMax);
  const [groupId, setGroupId] = useState('');
  const [answers, setAnswers] = useState<Record<string, MutabaahAnswerValue>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data, isLoading, refetch } = useQuery<MutabaahMyResponse>({
    queryKey: ['mutabaah-my', groupId, weekDate],
    queryFn: async () => {
      const params = new URLSearchParams({ weekDate });
      if (groupId) params.set('groupId', groupId);
      return (await api.get<ApiResponse<MutabaahMyResponse>>(`/mutabaah/my?${params}`)).data.data;
    },
    enabled: !!weekDate,
  });

  const selectedGroupMeta = useMemo(() => {
    if (data?.minWeekDate) {
      return { minWeekDate: toWeekDateParam(data.minWeekDate), joinedAt: data.joinedAt };
    }
    if (data?.groups && groupId) {
      const group = data.groups.find((g) => g.id === groupId);
      if (group?.minWeekDate) {
        return { minWeekDate: toWeekDateParam(group.minWeekDate), joinedAt: group.joinedAt };
      }
    }
    return null;
  }, [data?.minWeekDate, data?.joinedAt, data?.groups, groupId]);

  const weekMin = selectedGroupMeta?.minWeekDate;

  useEffect(() => {
    if (data?.needsGroupSelection && data.groups?.length && !groupId) {
      setGroupId(data.groups[0].id);
      return;
    }
    if (data?.group && !groupId) setGroupId(data.group.id);
  }, [data, groupId]);

  useEffect(() => {
    if (!selectedGroupMeta?.minWeekDate) return;
    const min = selectedGroupMeta.minWeekDate;
    if (weekDate < min) {
      setWeekDate(min > todayMax ? todayMax : min);
    }
  }, [selectedGroupMeta?.minWeekDate, weekDate, todayMax]);

  useEffect(() => {
    if (!data?.items) return;
    const next: Record<string, MutabaahAnswerValue> = {};
    for (const item of data.items) next[item.id] = item.value;
    setAnswers(next);
  }, [data?.items, data?.id]);

  const items = data?.items ?? [];
  const isSubmitted = data?.isSubmitted ?? false;

  const buildPayload = () => ({
    groupId: data?.group?.id || groupId,
    weekDate,
    answers: items.map((item) => ({
      itemId: item.id,
      value: answers[item.id] ?? item.value,
    })),
  });

  const save = async (submit = false) => {
    try {
      setLoading(true);
      setError('');
      const payload = buildPayload();
      if (submit) {
        await api.post('/mutabaah/my/submit', payload);
      } else {
        await api.put('/mutabaah/my', payload);
      }
      await invalidateMutabaahQueries(queryClient);
      await refetch();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal menyimpan mutabaah',
      );
    } finally {
      setLoading(false);
    }
  };

  if (isLoading && !data) {
    return (
      <PageContainer tight>
        <LoadingSkeleton className="h-64 rounded-2xl" />
      </PageContainer>
    );
  }

  return (
    <RoleGuard allowedRoles={['ANGGOTA']}>
      <PageContainer tight className="max-w-2xl">
        <PageHeader
          title="Mutabaah Yaumiyah"
          description="Isi laporan ibadah harian pekan ini sebelum pertemuan pembinaan · +2 poin saat dikirim"
          compact
        />

        {data?.needsGroupSelection && data.groups && (
          <ListGroup className="mb-4 p-4">
            <Label className="text-xs text-muted-foreground">Kelompok</Label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              {data.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </ListGroup>
        )}

        <ListGroup className="mb-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs text-muted-foreground">Pekan (Senin)</Label>
              <Input
                type="date"
                min={weekMin}
                max={todayMax}
                value={weekDate}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value || value > todayMax || (weekMin && value < weekMin)) return;
                  setWeekDate(value);
                }}
                className="mt-2"
              />
              <p className="mt-1 text-xs text-muted-foreground">Pekan {formatWeekRange(weekDate)}</p>
              {selectedGroupMeta?.joinedAt && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Sejak bergabung: {formatDate(selectedGroupMeta.joinedAt)}
                </p>
              )}
            </div>
            {data?.group && (
              <div>
                <Label className="text-xs text-muted-foreground">Kelompok</Label>
                <p className="mt-2 text-sm font-medium">{data.group.name}</p>
              </div>
            )}
          </div>
          {isSubmitted && (
            <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Mutabaah pekan ini sudah dikirim
            </p>
          )}
        </ListGroup>

        {!items.length ? (
          <ListGroup className="p-6 text-center text-sm text-muted-foreground">
            Belum ada master mutabaah untuk level kelompok Anda
          </ListGroup>
        ) : (
          <ListGroup className="space-y-6 p-5">
            {items.map((item) => (
              <div key={item.id} className="space-y-3">
                <MutabaahFieldLabel item={item} />
                <MutabaahFieldInput
                  item={item}
                  value={answers[item.id] ?? item.value}
                  disabled={isSubmitted}
                  onChange={(value) => setAnswers((prev) => ({ ...prev, [item.id]: value }))}
                />
              </div>
            ))}
          </ListGroup>
        )}

        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        {!isSubmitted && items.length > 0 && (
          <div className={cn('mt-4 flex gap-2')}>
            <Button variant="outline" className="flex-1 rounded-xl" disabled={loading} onClick={() => save(false)}>
              Simpan draft
            </Button>
            <Button className="flex-1 rounded-xl" disabled={loading} onClick={() => save(true)}>
              Kirim mutabaah
            </Button>
          </div>
        )}
      </PageContainer>
    </RoleGuard>
  );
}
