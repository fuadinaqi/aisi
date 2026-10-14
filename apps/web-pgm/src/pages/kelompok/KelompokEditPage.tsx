
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ArrowLeft } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { useActiveRole } from '@/components/layout/RoleGuard';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { invalidateGroupQueries } from '@/lib/queryInvalidation';
import type { GroupItem } from '@/lib/types';
import { GenderSelect } from '@/components/shared/GenderField';
import { useGroupLevelLabels } from '@/hooks/useGroupLevelLabels';
import { toastError, toastSuccess } from '@/lib/toast';
import { pembinaSchoolHint } from '@/lib/utils';
import { SearchableSelect } from '@/components/ui/searchable-select';
import type { GroupLevel } from '@dakwah/shared';

type PembinaOption = {
  id: string;
  name: string;
  email: string;
  gender?: string;
  inSchool?: boolean;
  hasAnySchool?: boolean;
};

type FormData = {
  name: string;
  level: GroupLevel;
  gender: 'IKHWAN' | 'AKHWAT';
  pembinaId: string;
};

export default function EditKelompokPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = useActiveRole() || '';
  const canChangePembina = role === 'PJ_SEKOLAH' || role === 'ADMIN' || role === 'SUPERADMIN';
  const [error, setError] = useState('');
  const { configs: levelConfigs } = useGroupLevelLabels();

  const { data: group, isLoading } = useQuery<GroupItem>({
    queryKey: ['group', id],
    queryFn: async () => (await api.get<ApiResponse<GroupItem>>(`/groups/${id}`)).data.data,
    enabled: !!id,
  });

  const { data: pembinaList = [], isLoading: pembinaLoading } = useQuery<PembinaOption[]>({
    queryKey: ['school-pembina', group?.school.id],
    queryFn: async () =>
      (
        await api.get<ApiResponse<PembinaOption[]>>(`/schools/${group!.school.id}/pembina`)
      ).data.data,
    enabled: !!group?.school.id && canChangePembina,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({
    defaultValues: {
      name: '',
      level: 'LEVEL_1',
      gender: 'IKHWAN',
      pembinaId: '',
    },
  });

  useEffect(() => {
    register('pembinaId', { required: canChangePembina ? 'Pembina wajib dipilih' : false });
  }, [register, canChangePembina]);

  useEffect(() => {
    if (!group) return;
    reset({
      name: group.name,
      level: (group.level as GroupLevel) || 'LEVEL_1',
      gender: group.gender === 'AKHWAT' ? 'AKHWAT' : 'IKHWAN',
      pembinaId: group.pembina.id,
    });
  }, [group, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      const payload: Record<string, string> = {
        name: data.name.trim(),
        level: data.level,
        gender: data.gender,
      };
      if (canChangePembina && data.pembinaId) {
        payload.pembinaId = data.pembinaId;
      }

      await api.put(`/groups/${id}`, payload);
      await invalidateGroupQueries(queryClient, { groupId: id, schoolId: group?.school.id });
      toastSuccess('Berhasil disimpan');
      navigate(`/kelompok/${id}`);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal memperbarui kelompok',
      );
      toastError(err, 'Gagal menyimpan');
    }
  };

  if (isLoading) {
    return (
      <PageContainer tight>
        <LoadingSkeleton className="h-64 rounded-2xl" />
      </PageContainer>
    );
  }

  if (!group) return null;

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH', 'PEMBINA']}>
      <PageContainer tight className="max-w-lg">
        <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
          <Link to={`/kelompok/${id}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Kembali
          </Link>
        </Button>

        <PageHeader title="Edit kelompok" compact />

        <p className="mb-4 px-0.5 text-sm text-muted-foreground">{group.school.name}</p>

        <ListGroup className="p-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Nama kelompok</Label>
              <Input
                id="name"
                className="rounded-xl"
                placeholder="Kelompok Alpha"
                {...register('name', { required: 'Nama kelompok wajib diisi' })}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="level">Level</Label>
              <SearchableSelect
                id="level"
                value={watch('level')}
                onChange={(next) => setValue('level', next as FormData['level'])}
                options={levelConfigs.map((cfg) => ({ value: cfg.level, label: cfg.label }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Jenis kelompok</Label>
              <GenderSelect
                id="gender"
                value={watch('gender')}
                onChange={(next) => setValue('gender', next, { shouldValidate: true })}
                disabled={(group.members?.length ?? 0) > 0}
              />
              {(group.members?.length ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Jenis kelompok tidak dapat diubah selama masih ada anggota.
                </p>
              )}
              {errors.gender && <p className="text-sm text-destructive">{errors.gender.message}</p>}
            </div>

            {canChangePembina && (
              <div className="space-y-2">
                <Label htmlFor="pembinaId">Pembina</Label>
                {pembinaLoading ? (
                  <p className="text-sm text-muted-foreground">Memuat daftar pembina...</p>
                ) : (
                  <SearchableSelect
                    id="pembinaId"
                    value={watch('pembinaId')}
                    onChange={(next) => setValue('pembinaId', next, { shouldValidate: true })}
                    options={pembinaList.map((p) => ({
                      value: p.id,
                      label: `${p.name} (${p.email})${p.gender ? ` · ${p.gender === 'AKHWAT' ? 'Akhwat' : 'Ikhwan'}` : ''}${pembinaSchoolHint(p)}`,
                    }))}
                    placeholder="Pilih pembina..."
                    searchPlaceholder="Cari nama atau email pembina..."
                    emptyText="Pembina tidak ditemukan"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Pembina boleh beda gender dari jenis kelompok, termasuk dari PGM lain atau
                  yang belum terikat PGM.
                </p>
                {errors.pembinaId && (
                  <p className="text-sm text-destructive">{errors.pembinaId.message}</p>
                )}
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl">
              {isSubmitting ? 'Menyimpan...' : 'Simpan perubahan'}
            </Button>
          </form>
        </ListGroup>
      </PageContainer>
    </RoleGuard>
  );
}
