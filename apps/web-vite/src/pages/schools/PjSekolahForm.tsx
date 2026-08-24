import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { invalidateInvitationQueries, invalidateSchoolQueries } from '@/lib/queryInvalidation';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { InviteForm } from '@/components/shared/InviteForm';
import { Button } from '@/components/ui/button';
import { toastError, toastSuccess } from '@/lib/toast';
import { PjCandidatePicker } from './PjCandidatePicker';
import type { SchoolDetail } from '@/lib/types';

type Props = {
  replace?: boolean;
  replaceUserId?: string;
  replaceUserName?: string;
};

export function PjSekolahForm({ replace = false, replaceUserId, replaceUserName }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [userId, setUserId] = useState('');
  const [alsoAsPembina, setAlsoAsPembina] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: school } = useQuery<SchoolDetail>({
    queryKey: ['school', id],
    queryFn: async () => (await api.get<ApiResponse<SchoolDetail>>(`/schools/${id}`)).data.data,
    enabled: !!id,
  });

  const afterSave = async (message: string) => {
    await invalidateSchoolQueries(queryClient, id);
    await invalidateInvitationQueries(queryClient);
    toastSuccess(message);
    navigate(`/schools/${id}`);
  };

  const submitExisting = async () => {
    if (!userId) {
      setError('Pilih user yang akan dijadikan PJ Sekolah');
      return;
    }
    try {
      setError('');
      setSubmitting(true);
      const res = await api.post(`/schools/${id}/pj`, {
        userId,
        alsoAsPembina,
        replace,
        ...(replaceUserId ? { replaceUserId } : {}),
      });
      await afterSave(res.data?.message || (replace ? 'PJ Sekolah berhasil diganti' : 'PJ Sekolah berhasil ditambahkan'));
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal menyimpan PJ Sekolah',
      );
      toastError(err, 'Gagal menyimpan PJ Sekolah');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN']}>
      <PageContainer tight className="max-w-lg">
        <PageHeader
          title={replace ? 'Ganti PJ Sekolah' : 'Tambah PJ Sekolah'}
          compact
          action={
            <Button asChild variant="ghost" size="sm" className="rounded-xl">
              <Link to={`/schools/${id}`}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Kembali
              </Link>
            </Button>
          }
        />

        <ListGroup className="p-5">
          <div className="mb-4 space-y-1">
            <p className="text-sm font-semibold">
              {replace ? 'PJ Sekolah pengganti' : 'PJ Sekolah'}
            </p>
            <p className="text-xs text-muted-foreground">
              {replace && replaceUserName
                ? `${replaceUserName} akan dilepas dari sekolah ini.`
                : replace
                  ? 'PJ lama akan dilepas dari sekolah ini.'
                  : 'Pilih user yang sudah ada, atau buat akun PJ baru. Sekolah dapat memiliki lebih dari satu PJ.'}
            </p>
          </div>

          <div className="mb-4 flex gap-2">
            <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-border/60 p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input
                type="radio"
                name="pjMode"
                value="existing"
                checked={mode === 'existing'}
                onChange={() => {
                  setMode('existing');
                  setError('');
                }}
              />
              <span className="text-sm">Pilih user</span>
            </label>
            <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-border/60 p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input
                type="radio"
                name="pjMode"
                value="new"
                checked={mode === 'new'}
                onChange={() => {
                  setMode('new');
                  setError('');
                }}
              />
              <span className="text-sm">Buat akun baru</span>
            </label>
          </div>

          {mode === 'existing' ? (
            <div className="space-y-4">
              <PjCandidatePicker
                schoolId={id}
                value={userId}
                onChange={(next) => {
                  setUserId(next);
                  setError('');
                }}
                targetSchoolName={school?.name}
              />
              <label className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={alsoAsPembina}
                  onChange={(e) => setAlsoAsPembina(e.target.checked)}
                />
                <span className="text-sm">
                  <span className="font-medium">Juga jadikan Pembina</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Ditambahkan jika user belum punya peran Pembina.
                  </span>
                </span>
              </label>
              {error && (
                <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
              )}
              <div className="flex gap-2">
                <Button type="button" disabled={submitting} className="rounded-xl" onClick={submitExisting}>
                  {submitting ? 'Memproses...' : replace ? 'Ganti PJ' : 'Jadikan PJ Sekolah'}
                </Button>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => navigate(-1)}>
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <InviteForm
              description="Akun atau undangan PJ baru akan dibuat untuk sekolah ini."
              submitLabel={replace ? 'Ganti PJ' : 'Tambah PJ Sekolah'}
              showPhone
              showGender
              showPasswordOption
              showAlsoAsPembina
              onCancel={() => navigate(-1)}
              onSubmit={async (data) => {
                await api.post(`/schools/${id}/pj`, {
                  ...data,
                  replace,
                  ...(replaceUserId ? { replaceUserId } : {}),
                });
                await invalidateSchoolQueries(queryClient, id);
                await invalidateInvitationQueries(queryClient);
                navigate(`/schools/${id}`);
              }}
            />
          )}
        </ListGroup>
      </PageContainer>
    </RoleGuard>
  );
}
