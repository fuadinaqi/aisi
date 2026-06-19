'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleGuard } from '@/components/layout/RoleGuard';

export default function InviteUserPage() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<{ name: string; email: string; role: string; schoolId?: string }>();

  const onSubmit = async (data: { name: string; email: string; role: string }) => {
    try {
      setError('');
      await api.post('/invitations', data);
      setSuccess('Undangan berhasil dikirim! Cek console API untuk link.');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal');
    }
  };

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH', 'PEMBINA']}>
      <Card className="max-w-md">
        <CardHeader><CardTitle>Undang User Baru</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div><Label>Nama</Label><Input {...register('name', { required: true })} /></div>
            <div><Label>Email</Label><Input type="email" {...register('email', { required: true })} /></div>
            <div>
              <Label>Role</Label>
              <select className="flex h-10 w-full rounded-md border px-3" {...register('role')}>
                <option value="ADMIN">Admin</option>
                <option value="PJ_SEKOLAH">PJ Sekolah</option>
                <option value="PEMBINA">Pembina</option>
                <option value="ANGGOTA">Anggota</option>
              </select>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}
            <Button type="submit" disabled={isSubmitting}>Kirim Undangan</Button>
          </form>
        </CardContent>
      </Card>
    </RoleGuard>
  );
}
