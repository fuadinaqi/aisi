'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ArrowLeft } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type PembinaOption = { id: string; name: string; email: string };

type FormData = {
  name: string;
  level: 'LEVEL_1' | 'LEVEL_2';
  pembinaMode: 'existing' | 'new';
  pembinaId: string;
  pembinaName: string;
  pembinaEmail: string;
  pembinaPhone: string;
  pembinaPassword: string;
  useDirectPassword: boolean;
};

export default function NewSchoolGroupPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: pembinaList = [], isLoading } = useQuery<PembinaOption[]>({
    queryKey: ['school-pembina', id],
    queryFn: async () => (await api.get<ApiResponse<PembinaOption[]>>(`/schools/${id}/pembina`)).data.data,
    enabled: !!id,
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      level: 'LEVEL_1',
      pembinaMode: 'new',
      pembinaId: '',
      useDirectPassword: false,
    },
  });

  const pembinaMode = watch('pembinaMode');
  const useDirectPassword = watch('useDirectPassword');

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      setSuccess('');

      const payload =
        data.pembinaMode === 'existing'
          ? {
              name: data.name.trim(),
              level: data.level,
              pembinaId: data.pembinaId,
            }
          : {
              name: data.name.trim(),
              level: data.level,
              pembina: {
                name: data.pembinaName.trim(),
                email: data.pembinaEmail.trim(),
                phone: data.pembinaPhone.trim() || undefined,
                ...(data.useDirectPassword && data.pembinaPassword
                  ? { password: data.pembinaPassword }
                  : {}),
              },
            };

      const res = await api.post(`/schools/${id}/groups`, payload);
      await queryClient.invalidateQueries({ queryKey: ['school', id] });
      await queryClient.invalidateQueries({ queryKey: ['school-pembina', id] });
      await queryClient.invalidateQueries({ queryKey: ['groups'] });

      const mode = res.data?.data?.mode;
      if (mode === 'invite') {
        setSuccess('Undangan pembina dikirim. Buat kelompok lagi setelah pembina aktif.');
        return;
      }

      const groupId = res.data?.data?.group?.id;
      setSuccess('Kelompok berhasil dibuat.');
      setTimeout(() => router.push(groupId ? `/kelompok/${groupId}` : `/schools/${id}`), 1200);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal membuat kelompok',
      );
    }
  };

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH']}>
      <PageContainer tight className="max-w-lg">
        <PageHeader
          title="Tambah kelompok"
          compact
          action={
            <Button asChild variant="ghost" size="sm" className="rounded-xl">
              <Link href={`/schools/${id}`}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Kembali
              </Link>
            </Button>
          }
        />

        <ListGroup className="p-5">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat data pembina...</p>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Data kelompok</p>
                <p className="text-xs text-muted-foreground">Kelompok baru akan ditambahkan ke sekolah ini.</p>
              </div>

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

              <div className="border-t border-border/60 pt-5">
                <p className="mb-3 text-sm font-semibold">Pembina kelompok</p>

                <div className="mb-4 flex gap-2">
                  <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-border/60 p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input
                      type="radio"
                      value="existing"
                      {...register('pembinaMode')}
                      disabled={pembinaList.length === 0}
                    />
                    <span className="text-sm">Pilih pembina</span>
                  </label>
                  <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-border/60 p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input type="radio" value="new" {...register('pembinaMode')} />
                    <span className="text-sm">Pembina baru</span>
                  </label>
                </div>

                {pembinaMode === 'existing' ? (
                  <div className="space-y-2">
                    <Label htmlFor="pembinaId">Pembina</Label>
                    <select
                      id="pembinaId"
                      className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      {...register('pembinaId', { required: pembinaMode === 'existing' })}
                    >
                      <option value="">Pilih pembina...</option>
                      {pembinaList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.email})
                        </option>
                      ))}
                    </select>
                    {pembinaList.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Belum ada pembina. Pilih opsi &quot;Pembina baru&quot;.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="pembinaName">Nama pembina</Label>
                      <Input
                        id="pembinaName"
                        className="rounded-xl"
                        {...register('pembinaName', { required: pembinaMode === 'new' })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pembinaEmail">Email pembina</Label>
                      <Input
                        id="pembinaEmail"
                        type="email"
                        className="rounded-xl"
                        {...register('pembinaEmail', { required: pembinaMode === 'new' })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pembinaPhone">No. telepon (opsional)</Label>
                      <Input id="pembinaPhone" className="rounded-xl" {...register('pembinaPhone')} />
                    </div>
                    <label className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
                      <input type="checkbox" className="mt-1" {...register('useDirectPassword')} />
                      <span className="text-sm">
                        <span className="font-medium">Set password langsung</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          Wajib dicentang agar kelompok langsung dibuat. Tanpa ini hanya undangan pembina yang
                          dikirim.
                        </span>
                      </span>
                    </label>
                    {useDirectPassword && (
                      <div className="space-y-2">
                        <Label htmlFor="pembinaPassword">Password pembina</Label>
                        <Input
                          id="pembinaPassword"
                          type="password"
                          className="rounded-xl"
                          {...register('pembinaPassword', { required: useDirectPassword })}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
              )}
              {success && (
                <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
              )}

              <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl">
                {isSubmitting ? 'Menyimpan...' : 'Buat kelompok'}
              </Button>
            </form>
          )}
        </ListGroup>
      </PageContainer>
    </RoleGuard>
  );
}
