import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { invalidateInvitationQueries } from '@/lib/queryInvalidation';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GenderSelect } from '@/components/shared/GenderField';
import { toastError, toastSuccess } from '@/lib/toast';

type FormData = {
  name: string;
  email: string;
  gender: 'IKHWAN' | 'AKHWAT';
  alsoAsPembina: boolean;
};

export default function InviteAdminPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({
    defaultValues: { gender: 'IKHWAN', alsoAsPembina: true },
  });

  const alsoAsPembina = watch('alsoAsPembina');

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      setSuccess('');
      await api.post('/invitations', {
        name: data.name.trim(),
        email: data.email.trim(),
        role: 'ADMIN',
        alsoAsPembina: data.alsoAsPembina,
        ...(data.alsoAsPembina ? { gender: data.gender } : {}),
      });
      await invalidateInvitationQueries(queryClient);
      setSuccess('Undangan admin berhasil dikirim. Cek log API untuk link aktivasi.');
      toastSuccess('Undangan berhasil dikirim');
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal mengirim undangan',
      );
      toastError(err, 'Gagal mengirim undangan');
    }
  };

  return (
    <RoleGuard allowedRoles={['SUPERADMIN']}>
      <PageContainer tight className="max-w-lg">
        <PageHeader
          title="Undang Admin"
          description="Hanya Superadmin yang dapat menambah admin baru ke sistem"
        />

        <ListGroup className="p-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Nama lengkap</Label>
              <Input className="rounded-xl" {...register('name', { required: true })} placeholder="Nama admin" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                className="rounded-xl"
                {...register('email', { required: true })}
                placeholder="admin@email.com"
              />
            </div>
            <label className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
              <input type="checkbox" className="mt-1" {...register('alsoAsPembina')} />
              <span className="text-sm">
                <span className="font-medium">Juga jadikan Pembina</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Default tercentang; bisa di-uncheck jika tidak diperlukan.
                </span>
              </span>
            </label>
            {alsoAsPembina && (
              <div className="space-y-2">
                <Label>Jenis kelamin</Label>
                <GenderSelect
                  {...register('gender', {
                    required: alsoAsPembina ? 'Jenis kelamin wajib dipilih' : false,
                  })}
                />
                {errors.gender && <p className="text-sm text-destructive">{errors.gender.message}</p>}
              </div>
            )}
            {error && (
              <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
            )}
            {success && (
              <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
            )}
            <Button type="submit" disabled={isSubmitting} className="rounded-xl">
              {isSubmitting ? 'Mengirim...' : 'Kirim undangan admin'}
            </Button>
          </form>
        </ListGroup>
      </PageContainer>
    </RoleGuard>
  );
}
