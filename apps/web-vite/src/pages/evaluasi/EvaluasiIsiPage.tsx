
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
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
import { toastError, toastSuccess } from '@/lib/toast';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useActiveRole } from '@/components/layout/RoleGuard';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

const STATUSES = ['HADIR', 'IZIN', 'SAKIT', 'TIDAK_HADIR'] as const;
const statusLabels: Record<string, string> = {
  HADIR: 'Hadir',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
  TIDAK_HADIR: 'Tidak hadir',
};

export default function IsiEvaluasiPage() {
  const role = useActiveRole() || '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: groups } = useQuery<GroupItem[]>({
    queryKey: ['groups', role],
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
          (ev.attendances ?? []).map((a) => ({
            userId: a.userId,
            name: a.user?.name ?? '-',
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
    const alreadySubmitted = isSubmitted;

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
      if (submit && !alreadySubmitted) {
        await api.post(`/evaluations/${id}/submit`);
        await invalidateEvaluationQueries(queryClient);
        toastSuccess('Evaluasi berhasil dikirim');
        navigate('/evaluasi');
      } else {
        await invalidateEvaluationQueries(queryClient);
        toastSuccess(alreadySubmitted ? 'Evaluasi berhasil diperbarui' : 'Berhasil disimpan');
      }
    } catch (err: unknown) {
      setError(
        (err as Error)?.message ||
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal menyimpan',
      );
      toastError(err, 'Gagal menyimpan');
    } finally {
      setLoading(false);
    }
  };

  const removeEvaluation = async () => {
    if (!evalId) return;
    await api.delete(`/evaluations/${evalId}`);
    await invalidateEvaluationQueries(queryClient);
    toastSuccess('Evaluasi berhasil dihapus');
    navigate('/evaluasi');
  };

  const isEditing = !!evalId && !isSubmitted;

  return (
    <PageContainer className="max-w-2xl">
      <PageHeader
        title={evalId ? 'Edit evaluasi' : 'Isi evaluasi'}
        description={
          isSubmitted
            ? 'Perbaiki kehadiran dan catatan yang sudah dikirim'
            : isEditing
              ? 'Perbarui draft evaluasi pekan yang sama'
              : 'Catat kehadiran anggota untuk pekan ini'
        }
      />

      {isSubmitted && (
        <div className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Evaluasi pekan {formatWeekRange(weekDate)} sudah dikirim. Kehadiran dan catatan masih bisa diperbaiki.{' '}
          <Link to={`/evaluasi/${evalId}`} className="font-medium underline">
            Lihat detail
          </Link>
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
              <SearchableSelect
                value={groupId}
                onChange={handleGroupChange}
                disabled={evalLoading}
                placeholder="Pilih kelompok"
                searchPlaceholder="Cari kelompok..."
                options={(groups || []).map((g) => ({ value: g.id, label: g.name }))}
              />
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
                <Label htmlFor="notes">Catatan umum</Label>
                <textarea
                  id="notes"
                  value={notes}
                  rows={4}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opsional"
                  className="flex min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {isSubmitted ? (
            <Button onClick={() => save(false)} disabled={loading || evalLoading} className="w-full">
              Simpan perubahan
            </Button>
          ) : (
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
          {evalId && !evalLoading && (
            <Button
              type="button"
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              disabled={loading}
              onClick={() => setConfirmDelete(true)}
            >
              Hapus evaluasi
            </Button>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Hapus evaluasi?"
        description={
          isSubmitted
            ? `Evaluasi pekan ${formatWeekRange(weekDate)} akan dihapus beserta kehadirannya. Poin yang sudah diberikan dari evaluasi ini ikut ditarik.`
            : `Draft evaluasi pekan ${formatWeekRange(weekDate)} akan dihapus.`
        }
        confirmLabel="Hapus"
        destructive
        onConfirm={removeEvaluation}
      />
    </PageContainer>
  );
}
