'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@dakwah/shared';
import { api, type ApiResponse } from '@/lib/api';
import { useAuthStore, type AuthUser } from '@/store/authStore';
import { AppLogo } from '@/components/layout/AppLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';

const LOGIN_QUOTE =
  '"Tumbuh bersama, berdampak untuk umat, bersinar dengan kebaikan."';

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
    <div className="flex min-h-[100dvh] flex-col bg-[hsl(var(--surface))] lg:min-h-screen lg:flex-row lg:bg-background">
      {/* Desktop — panel kiri */}
      <div className="hidden w-1/2 flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <AppLogo href="/login" size="lg" imageClassName="brightness-0 invert" priority />
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Pendataan & monitoring pembinaan, lebih terstruktur.
          </h2>
          <p className="max-w-md text-sm italic leading-relaxed text-primary-foreground/85">
            {LOGIN_QUOTE}
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">Kota Depok</p>
      </div>

      {/* Mobile — hero */}
      <div className="relative shrink-0 overflow-hidden bg-primary px-5 pb-7 pt-[max(1.75rem,env(safe-area-inset-top))] text-primary-foreground lg:hidden">
        <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 -left-6 h-20 w-20 rounded-full bg-white/5" />
        <div className="relative space-y-4">
          <AppLogo href="/login" size="lg" imageClassName="brightness-0 invert" priority />
          <p className="max-w-[18rem] text-sm italic leading-relaxed text-primary-foreground/90">
            {LOGIN_QUOTE}
          </p>
        </div>
      </div>

      {/* Form — satu instance saja */}
      <div className="flex flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 lg:justify-center lg:px-12 lg:py-12">
        <div className="mx-auto w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-sm lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="mb-6 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">Masuk</h1>
            <p className="text-sm text-muted-foreground">
              Gunakan email dan password yang terdaftar
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="nama@email.com" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput id="password" {...register('password')} />
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

        <p className="mt-auto pt-8 text-center text-xs text-muted-foreground lg:hidden">Kota Depok</p>
      </div>
    </div>
  );
}
