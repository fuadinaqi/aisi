'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { invalidateEvaluationQueries } from '@/lib/queryInvalidation';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatWeekRange, toDateInputValue, toWeekDateParam } from '@/lib/utils';
import type { EvaluationItem, GroupItem } from '@/lib/types';

const STATUSES = ['HADIR', 'IZIN', 'SAKIT', 'TIDAK_HADIR'] as const;
const statusLabels: Record<string, string> = {
  HADIR: 'Hadir',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
  TIDAK_HADIR: 'Tidak hadir',
};

export default function IsiEvaluasiPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const todayMax = toDateInputValue();
  const [groupId, setGroupId] = useState(searchParams.get('groupId') || '');
  const [weekDate, setWeekDate] = useState(searchParams.get('weekDate') || todayMax);
  const [notes, setNotes] = useState('');
  const [attendances, setAttendances] = useState<
    { userId: string; name: string; status: string; note?: string }[]
  >([]);
  const [evalId, setEvalId] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: groups } = useQuery<GroupItem[]>({
    queryKey: ['groups'],
    queryFn: async () => (await api.get<ApiResponse<GroupItem[]>>('/groups')).data.data,
  });

  useEffect(() => {
    if (groups?.length && !groupId) setGroupId(groups[0].id);
  }, [groups, groupId]);

  const loadGroupMembers = useCallback(async (gid: string) => {
    const res = await api.get<ApiResponse<GroupItem>>(`/groups/${gid}`);
    setAttendances(
      res.data.data.members?.map((m) => ({
        userId: m.user.id,
        name: m.user.name,
        status: 'HADIR',
      })) || [],
    );
  }, []);

  const loadExistingEvaluation = useCallback(async (gid: string, week: string) => {
    setEvalLoading(true);
    setError('');
    try {
      const res = await api.get<ApiResponse<EvaluationItem[]>>('/evaluations', {
        params: { groupId: gid, weekDate: toWeekDateParam(week), limit: 1 },
      });
      const ev = res.data.data?.[0];
      if (ev) {
        setEvalId(ev.id);
        setIsSubmitted(ev.isSubmitted);
        setWeekDate(toWeekDateParam(ev.weekDate));
        setNotes(ev.notes || '');
        setAttendances(
          ev.attendances.map((a) => ({
            userId: a.userId,
            name: a.user.name,
            status: a.status,
            note: a.note,
          })),
        );
      } else {
        setEvalId('');
        setIsSubmitted(false);
        setNotes('');
        await loadGroupMembers(gid);
      }
    } catch {
      setEvalId('');
      setIsSubmitted(false);
      setNotes('');
      await loadGroupMembers(gid);
    } finally {
      setEvalLoading(false);
    }
  }, [loadGroupMembers]);

  useEffect(() => {
    if (!groupId || !weekDate) return;
    loadExistingEvaluation(groupId, weekDate);
  }, [groupId, weekDate, loadExistingEvaluation]);

  const handleWeekDateChange = (value: string) => {
    if (!value || value > todayMax) return;
    setWeekDate(value);
  };

  const handleGroupChange = (value: string) => {
    setGroupId(value);
  };

  const save = async (submit = false) => {
    if (isSubmitted) return;

    try {
      setLoading(true);
      setError('');
      const payload = {
        groupId,
        weekDate,
        notes,
        attendances: attendances.map(({ userId, status, note }) => ({ userId, status, note })),
      };
      let id = evalId;
      if (id) {
        await api.put(`/evaluations/${id}`, payload);
      } else {
        try {
          const res = await api.post<ApiResponse<{ id: string }>>('/evaluations', payload);
          id = res.data.data.id;
          setEvalId(id);
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 409) {
            await loadExistingEvaluation(groupId, weekDate);
            throw new Error(
              (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Evaluasi pekan ini sudah ada. Form telah dimuat untuk diedit.',
            );
          }
          throw err;
        }
      }
      if (submit) {
        await api.post(`/evaluations/${id}/submit`);
        await invalidateEvaluationQueries(queryClient);
        router.push('/evaluasi');
      } else {
        await invalidateEvaluationQueries(queryClient);
      }
    } catch (err: unknown) {
      setError(
        (err as Error)?.message ||
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal menyimpan',
      );
    } finally {
      setLoading(false);
    }
  };

  const isEditing = !!evalId && !isSubmitted;

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader
        title={isSubmitted ? 'Evaluasi pekan ini' : isEditing ? 'Edit evaluasi' : 'Isi evaluasi'}
        description={
          isSubmitted
            ? 'Evaluasi pekan ini sudah dikirim'
            : isEditing
              ? 'Perbarui draft evaluasi pekan yang sama'
              : 'Catat kehadiran anggota untuk pekan ini'
        }
      />

      {isSubmitted && (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Evaluasi pekan {formatWeekRange(weekDate)} sudah dikirim dan tidak bisa diubah.{' '}
          <Link href={`/evaluasi/${evalId}`} className="font-medium underline">
            Lihat detail
          </Link>
          <p className="mt-2 text-emerald-900/80">
            Untuk isi pekan berikutnya, ubah tanggal pekan di bawah (mis. pekan {formatWeekRange(todayMax)}).
          </p>
        </div>
      )}

      {isEditing && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Evaluasi untuk pekan ini sudah ada. Anda sedang mengedit draft yang tersimpan.
        </div>
      )}

      <Card>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kelompok</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
                value={groupId}
                disabled={evalLoading}
                onChange={(e) => handleGroupChange(e.target.value)}
              >
                {groups?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Pekan (Senin)</Label>
              <Input
                type="date"
                value={weekDate}
                max={todayMax}
                disabled={evalLoading}
                onChange={(e) => handleWeekDateChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Pekan {formatWeekRange(weekDate)}</p>
            </div>
          </div>

          {evalLoading ? (
            <p className="text-sm text-muted-foreground">Memuat data evaluasi...</p>
          ) : (
            <>
              <div className="space-y-3">
                <Label>Kehadiran</Label>
                {attendances.map((att, i) => (
                  <div key={att.userId} className="rounded-lg border p-4">
                    <p className="mb-3 text-sm font-medium">{att.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {STATUSES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={isSubmitted}
                          onClick={() =>
                            setAttendances((prev) =>
                              prev.map((a, j) => (j === i ? { ...a, status: s } : a)),
                            )
                          }
                          className={cn(
                            'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60',
                            att.status === s
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-transparent bg-muted text-muted-foreground hover:bg-muted/80',
                          )}
                        >
                          {statusLabels[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Catatan umum</Label>
                <Input
                  value={notes}
                  disabled={isSubmitted}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opsional"
                />
              </div>
            </>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {!isSubmitted && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={() => save(false)}
                disabled={loading || evalLoading}
                variant="outline"
                className="flex-1"
              >
                Simpan draft
              </Button>
              <Button onClick={() => save(true)} disabled={loading || evalLoading} className="flex-1">
                Kirim evaluasi
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
