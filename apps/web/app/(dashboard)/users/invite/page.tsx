'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function InviteAdminPage() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<{
    name: string;
    email: string;
  }>();

  const onSubmit = async (data: { name: string; email: string }) => {
    try {
      setError('');
      setSuccess('');
      await api.post('/invitations', { ...data, role: 'ADMIN' });
      setSuccess('Undangan admin berhasil dikirim. Cek log API untuk link aktivasi.');
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal mengirim undangan',
      );
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
