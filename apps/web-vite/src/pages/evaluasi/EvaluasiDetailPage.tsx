
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type ApiResponse } from '@/lib/api';
import { invalidateEvaluationQueries } from '@/lib/queryInvalidation';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useActiveRole } from '@/components/layout/RoleGuard';
import { MutabaahMemberPanel } from '@/components/mutabaah/MutabaahMemberPanel';
import { formatWeekRange, toWeekDateParam } from '@/lib/utils';
import { toastSuccess } from '@/lib/toast';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import type { EvaluationItem } from '@/lib/types';

const statusLabel: Record<string, string> = {
  HADIR: 'Hadir',
  TIDAK_HADIR: 'Tidak hadir',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
};

export default function EvaluasiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const role = useActiveRole() || '';
  const canEditMutabaah =
    role === 'PEMBINA' || role === 'PJ_SEKOLAH' || role === 'ADMIN' || role === 'SUPERADMIN';

  const { data, isLoading, isError, error } = useQuery<EvaluationItem>({
    queryKey: ['evaluation', id],
    queryFn: async () => (await api.get<ApiResponse<EvaluationItem>>(`/evaluations/${id}`)).data.data,
    retry: false,
  });

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingSkeleton className="h-64" />
      </PageContainer>
    );
  }

  if (isError || !data) {
    const msg =
      (error as { response?: { data?: { message?: string }; status?: number } })?.response?.data
        ?.message ||
      ((error as { response?: { status?: number } })?.response?.status === 403
        ? 'Akses ditolak'
        : 'Evaluasi tidak ditemukan');
    return (
      <PageContainer>
        <PageHeader title="Evaluasi" description={msg} />
        <p className="text-sm text-destructive">{msg}</p>
        <Link to="/evaluasi" className="mt-3 inline-block text-sm text-primary hover:underline">
          Kembali ke daftar evaluasi
        </Link>
      </PageContainer>
    );
  }

  const group = data.group ?? { id: '', name: 'Evaluasi' };
  const attendances = data.attendances ?? [];

  return (
    <PageContainer>
      <PageHeader
        title={group.name}
        description={`Pekan ${formatWeekRange(data.weekDate)}`}
        action={
          role === 'PEMBINA' ? (
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to={`/evaluasi/isi?groupId=${group.id}&weekDate=${toWeekDateParam(data.weekDate)}`}>
                  Edit
                </Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                Hapus
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Kehadiran & mutabaah anggota</CardTitle>
            <p className="text-sm text-muted-foreground">
              Mutabaah ditampilkan untuk pekan evaluasi yang sama ({formatWeekRange(data.weekDate)})
            </p>
          </CardHeader>
          <CardContent className="divide-y px-0 pb-0 pt-0">
            {attendances.map((att) => {
              const isOpen = expandedUserId === att.userId;
              const userName = att.user?.name ?? '-';
              return (
                <div key={att.userId}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-muted/40"
                    onClick={() => setExpandedUserId(isOpen ? null : att.userId)}
                  >
                    <span className="text-sm font-medium">{userName}</span>
                    <span className="text-sm text-muted-foreground">
                      {statusLabel[att.status] || att.status}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t bg-muted/20 px-5 py-4">
                      <MutabaahMemberPanel
                        userId={att.userId}
                        groupId={group.id}
                        weekDate={data.weekDate}
                        userName={userName}
                        compact
                        canEdit={canEditMutabaah}
                      />
                      <Link
                        to={`/kelompok/${group.id}/anggota/${att.userId}?weekDate=${toWeekDateParam(data.weekDate)}`}
                        className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
                      >
                        Lihat detail anggota (pekan sama)
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium">{data.isSubmitted ? 'Terkirim' : 'Draft'}</p>
            </div>
            {data.notes && (
              <div>
                <p className="text-muted-foreground">Catatan pembina</p>
                <p className="whitespace-pre-wrap">{data.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Hapus evaluasi?"
        description={
          data.isSubmitted
            ? `Evaluasi pekan ${formatWeekRange(data.weekDate)} akan dihapus beserta kehadirannya. Poin yang sudah diberikan dari evaluasi ini ikut ditarik.`
            : `Draft evaluasi pekan ${formatWeekRange(data.weekDate)} akan dihapus.`
        }
        confirmLabel="Hapus"
        destructive
        onConfirm={async () => {
          await api.delete(`/evaluations/${id}`);
          await invalidateEvaluationQueries(queryClient);
          toastSuccess('Evaluasi berhasil dihapus');
          navigate('/evaluasi');
        }}
      />
    </PageContainer>
  );
}
