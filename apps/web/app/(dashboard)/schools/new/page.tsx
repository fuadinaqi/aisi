'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type FormData = {
  name: string;
  city: string;
  pjName: string;
  pjEmail: string;
  pjPhone: string;
  pjPassword: string;
  useDirectPassword: boolean;
};

export default function NewSchoolPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      city: 'Depok',
      useDirectPassword: false,
    },
  });

  const useDirectPassword = watch('useDirectPassword');

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      setSuccess('');

      const payload = {
        name: data.name.trim(),
        city: data.city.trim() || 'Depok',
        pj: {
          name: data.pjName.trim(),
          email: data.pjEmail.trim(),
          phone: data.pjPhone.trim() || undefined,
          ...(data.useDirectPassword && data.pjPassword ? { password: data.pjPassword } : {}),
        },
      };

      const res = await api.post('/schools', payload);
      await queryClient.invalidateQueries({ queryKey: ['schools'] });

      const mode = res.data?.data?.mode;
      setSuccess(
        mode === 'direct'
          ? 'Sekolah dan akun PJ Sekolah berhasil dibuat.'
          : 'Sekolah berhasil dibuat. Undangan aktivasi PJ telah dikirim (cek log API jika dev).',
      );

      setTimeout(() => router.push('/schools'), 1500);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal membuat sekolah',
      );
    }
  };

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN']}>
      <PageContainer tight className="max-w-lg">
        <PageHeader
          title="Tambah sekolah"
          compact
          action={
            <Button asChild variant="ghost" size="sm" className="rounded-xl">
              <Link href="/schools">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Kembali
              </Link>
            </Button>
          }
        />

        <ListGroup className="p-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Data sekolah</p>
              <p className="text-xs text-muted-foreground">Sekolah baru akan langsung terdaftar di sistem.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nama sekolah</Label>
              <Input
                id="name"
                placeholder="SMAN 4 Depok"
                className="rounded-xl"
                {...register('name', { required: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Kota</Label>
              <Input id="city" className="rounded-xl" {...register('city')} />
            </div>

            <div className="border-t border-border/60 pt-5">
              <div className="mb-4 space-y-1">
                <p className="text-sm font-semibold">PJ Sekolah</p>
                <p className="text-xs text-muted-foreground">
                  Penanggung jawab sekolah akan dibuat sekaligus dengan sekolah ini.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pjName">Nama PJ</Label>
                  <Input
                    id="pjName"
                    placeholder="Nama lengkap"
                    className="rounded-xl"
                    {...register('pjName', { required: true })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pjEmail">Email PJ</Label>
                  <Input
                    id="pjEmail"
                    type="email"
                    placeholder="pj@sekolah.com"
                    className="rounded-xl"
                    {...register('pjEmail', { required: true })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pjPhone">No. telepon (opsional)</Label>
                  <Input
                    id="pjPhone"
                    placeholder="08xxxxxxxxxx"
                    className="rounded-xl"
                    {...register('pjPhone')}
                  />
                </div>

                <label className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    {...register('useDirectPassword')}
                  />
                  <span className="text-sm">
                    <span className="font-medium">Set password langsung</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Jika tidak dicentang, PJ akan menerima undangan email untuk buat password sendiri.
                    </span>
                  </span>
                </label>

                {useDirectPassword && (
                  <div className="space-y-2">
                    <Label htmlFor="pjPassword">Password PJ</Label>
                    <Input
                      id="pjPassword"
                      type="password"
                      placeholder="Min. 8 karakter, huruf besar & angka"
                      className="rounded-xl"
                      {...register('pjPassword', { required: useDirectPassword })}
                    />
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
            )}
            {success && (
              <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl">
              {isSubmitting ? 'Menyimpan...' : 'Buat sekolah & PJ'}
            </Button>
          </form>
        </ListGroup>
      </PageContainer>
    </RoleGuard>
  );
}
