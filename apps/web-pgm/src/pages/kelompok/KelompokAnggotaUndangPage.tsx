import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { invalidateGroupQueries, invalidateInvitationQueries } from '@/lib/queryInvalidation';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { InviteForm } from '@/components/shared/InviteForm';
import { Button } from '@/components/ui/button';
import { toastError, toastSuccess } from '@/lib/toast';
import type { GroupItem } from '@/lib/types';
import { AnggotaCandidatePicker } from './AnggotaCandidatePicker';

export default function UndangAnggotaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: group } = useQuery<GroupItem>({
    queryKey: ['group', id],
    queryFn: async () => (await api.get<ApiResponse<GroupItem>>(`/groups/${id}`)).data.data,
    enabled: !!id,
  });

  const afterSave = async (message: string) => {
    await invalidateGroupQueries(queryClient, { groupId: id });
    await invalidateInvitationQueries(queryClient);
    toastSuccess(message);
    navigate(`/kelompok/${id}`);
  };

  const submitExisting = async () => {
    if (!userId) {
      setError('Pilih anggota yang akan ditambahkan ke kelompok');
      return;
    }
    try {
      setError('');
      setSubmitting(true);
      const res = await api.post(`/groups/${id}/members`, { userId });
      await afterSave(res.data?.message || 'Anggota berhasil ditambahkan');
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal menambahkan anggota',
      );
      toastError(err, 'Gagal menambahkan anggota');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer tight className="max-w-lg">
      <PageHeader
        title="Undang anggota"
        compact
        action={
          <Button asChild variant="ghost" size="sm" className="rounded-xl">
            <Link to={`/kelompok/${id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Kembali
            </Link>
          </Button>
        }
      />

      <ListGroup className="p-5">
        <div className="mb-4 space-y-1">
          <p className="text-sm font-semibold">Anggota kelompok</p>
          <p className="text-xs text-muted-foreground">
            Pilih anggota yang sudah terdaftar, atau undang akun baru
            {group?.name ? ` ke ${group.name}` : ''}. Jenis kelamin mengikuti jenis kelompok. Nama
            lengkap dan email wajib; no. telepon opsional.
          </p>
        </div>

        <div className="mb-4 flex gap-2">
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-border/60 p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input
              type="radio"
              name="anggotaMode"
              value="existing"
              checked={mode === 'existing'}
              onChange={() => {
                setMode('existing');
                setError('');
              }}
            />
            <span className="text-sm">Pilih anggota</span>
          </label>
          <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-border/60 p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input
              type="radio"
              name="anggotaMode"
              value="new"
              checked={mode === 'new'}
              onChange={() => {
                setMode('new');
                setError('');
              }}
            />
            <span className="text-sm">Undang anggota baru</span>
          </label>
        </div>

        {mode === 'existing' ? (
          <div className="space-y-4">
            <AnggotaCandidatePicker
              groupId={id}
              value={userId}
              onChange={(next) => {
                setUserId(next);
                setError('');
              }}
            />
            {error && (
              <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
            )}
            <div className="flex gap-2">
              <Button type="button" disabled={submitting} className="rounded-xl" onClick={submitExisting}>
                {submitting ? 'Memproses...' : 'Tambahkan ke kelompok'}
              </Button>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => navigate(-1)}>
                Batal
              </Button>
            </div>
          </div>
        ) : (
          <InviteForm
            description="Tanpa password, anggota menerima undangan email. Centang set password langsung agar akun langsung aktif, sama seperti undangan Pengurus PGM atau Pembina."
            submitLabel="Tambah anggota"
            successMessage="Anggota berhasil ditambahkan"
            showPhone
            showPasswordOption
            onCancel={() => navigate(-1)}
            onSubmit={async (data) => {
              await api.post(`/groups/${id}/members`, {
                name: data.name,
                email: data.email,
                phone: data.phone,
                password: data.password,
              });
              await invalidateGroupQueries(queryClient, { groupId: id });
              await invalidateInvitationQueries(queryClient);
              navigate(`/kelompok/${id}`);
            }}
          />
        )}
      </ListGroup>
    </PageContainer>
  );
}
