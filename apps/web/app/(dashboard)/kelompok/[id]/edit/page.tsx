'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ArrowLeft } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getPrimaryRole } from '@/lib/utils';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { invalidateGroupQueries } from '@/lib/queryInvalidation';
import type { GroupItem } from '@/lib/types';

type PembinaOption = { id: string; name: string; email: string };

type FormData = {
  name: string;
  level: 'LEVEL_1' | 'LEVEL_2';
  pembinaId: string;
};

export default function EditKelompokPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = user ? getPrimaryRole(user.roles) : '';
  const canChangePembina = role === 'PJ_SEKOLAH' || role === 'ADMIN' || role === 'SUPERADMIN';
  const [error, setError] = useState('');

  const { data: group, isLoading } = useQuery<GroupItem>({
    queryKey: ['group', id],
    queryFn: async () => (await api.get<ApiResponse<GroupItem>>(`/groups/${id}`)).data.data,
    enabled: !!id,
  });

  const { data: pembinaList = [], isLoading: pembinaLoading } = useQuery<PembinaOption[]>({
    queryKey: ['school-pembina', group?.school.id],
    queryFn: async () =>
      (await api.get<ApiResponse<PembinaOption[]>>(`/schools/${group!.school.id}/pembina`)).data.data,
    enabled: !!group?.school.id && canChangePembina,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormData>();

  useEffect(() => {
    if (!group) return;
    reset({
      name: group.name,
      level: (group.level as 'LEVEL_1' | 'LEVEL_2') || 'LEVEL_1',
      pembinaId: group.pembina.id,
    });
  }, [group, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      const payload: Record<string, string> = {
        name: data.name.trim(),
        level: data.level,
      };
      if (canChangePembina && data.pembinaId) {
        payload.pembinaId = data.pembinaId;
      }

      await api.put(`/groups/${id}`, payload);
      await invalidateGroupQueries(queryClient, { groupId: id, schoolId: group?.school.id });
      router.push(`/kelompok/${id}`);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal memperbarui kelompok',
      );
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
          <Link href={`/kelompok/${id}`}>
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
                placeholder="Kelompok Muda Alpha"
                {...register('name', { required: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="level">Level</Label>
              <select
                id="level"
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                {...register('level')}
              >
                <option value="LEVEL_1">Muda (Level 1)</option>
                <option value="LEVEL_2">Pratama (Level 2)</option>
              </select>
            </div>

            {canChangePembina && (
              <div className="space-y-2">
                <Label htmlFor="pembinaId">Pembina</Label>
                {pembinaLoading ? (
                  <p className="text-sm text-muted-foreground">Memuat daftar pembina...</p>
                ) : (
                  <select
                    id="pembinaId"
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    {...register('pembinaId', { required: true })}
                  >
                    {pembinaList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.email})
                      </option>
                    ))}
                  </select>
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
