'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { api, type ApiResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function UndangAnggotaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<{ name: string; email: string }>();

  const onSubmit = async (data: { name: string; email: string }) => {
    try {
      setError('');
      await api.post('/invitations', { ...data, role: 'ANGGOTA', groupId: id });
      setSuccess('Undangan berhasil dikirim! Cek console API untuk link.');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Gagal');
    }
  };

  return (
    <Card className="max-w-md">
      <CardHeader><CardTitle>Undang Anggota Baru</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div><Label>Nama</Label><Input {...register('name', { required: true })} /></div>
          <div><Label>Email</Label><Input type="email" {...register('email', { required: true })} /></div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>Kirim Undangan</Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>Batal</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
