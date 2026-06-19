'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { setPasswordSchema, type SetPasswordInput } from '@dakwah/shared';
import { api, type ApiResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleBadge } from '@/components/shared/Badges';

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [inviteInfo, setInviteInfo] = useState<{ name: string; email: string; role: string } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { token },
  });

  useEffect(() => {
    if (!token) { setError('Token tidak ditemukan'); return; }
    api.get<ApiResponse>(`/auth/invitation/${token}`)
      .then((res) => setInviteInfo(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Token tidak valid'));
  }, [token]);

  const onSubmit = async (data: SetPasswordInput) => {
    try {
      setError('');
      const res = await api.post<ApiResponse>('/auth/set-password', data);
      setSuccess(res.data.message || 'Akun berhasil dibuat');
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Gagal membuat password');
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Buat Password</CardTitle>
        {inviteInfo && (
          <div className="mt-2 space-y-1">
            <p className="text-sm">Halo, <strong>{inviteInfo.name}</strong></p>
            <p className="text-sm text-muted-foreground">{inviteInfo.email}</p>
            <RoleBadge role={inviteInfo.role} />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {success ? (
          <p className="text-center text-green-600">{success}</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <input type="hidden" {...register('token')} />
            <div>
              <Label htmlFor="password">Password Baru</Label>
              <PasswordInput id="password" {...register('password')} />
              {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>}
            </div>
            <div>
              <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
              <PasswordInput id="confirmPassword" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="mt-1 text-sm text-red-500">{errors.confirmPassword.message}</p>}
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting || !inviteInfo}>
              {isSubmitting ? 'Memproses...' : 'Buat Password'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default function SetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-sky-50 p-4">
      <Suspense fallback={<p>Memuat...</p>}>
        <SetPasswordForm />
      </Suspense>
    </div>
  );
}
