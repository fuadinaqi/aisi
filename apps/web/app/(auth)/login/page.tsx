'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@dakwah/shared';
import { api, type ApiResponse } from '@/lib/api';
import { useAuthStore, type AuthUser } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      setError('');
      const res = await api.post<ApiResponse<{ user: AuthUser; accessToken: string }>>(
        '/auth/login',
        data,
      );
      setAuth(res.data.data.user, res.data.data.accessToken);
      router.push('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Login gagal');
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div>
          <p className="text-lg font-semibold tracking-tight">AISI</p>
          <p className="mt-1 text-sm text-primary-foreground/80">Pembinaan Dakwah Depok</p>
        </div>
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Pendataan & monitoring pembinaan, lebih terstruktur.
          </h2>
          <p className="max-w-md text-sm text-primary-foreground/80">
            Kelola evaluasi mingguan, kehadiran anggota, dan perkembangan pembinaan dalam satu
            platform.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">Kota Depok</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 lg:hidden">
            <p className="text-lg font-semibold">AISI</p>
            <p className="text-sm text-muted-foreground">Masuk ke akun Anda</p>
          </div>
          <div className="hidden space-y-2 lg:block">
            <h1 className="text-2xl font-semibold tracking-tight">Masuk</h1>
            <p className="text-sm text-muted-foreground">Gunakan email dan password yang terdaftar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="nama@email.com" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Memproses...' : 'Masuk'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
