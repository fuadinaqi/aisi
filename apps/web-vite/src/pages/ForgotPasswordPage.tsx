import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@dakwah/shared';
import { api, type ApiResponse } from '@/lib/api';
import { AppLogo } from '@/components/layout/AppLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toastError, toastSuccess } from '@/lib/toast';

export default function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    try {
      const res = await api.post<ApiResponse>('/auth/forgot-password', data);
      const msg =
        res.data.message ||
        'Jika email terdaftar, tautan reset password telah dikirim';
      setMessage(msg);
      setDone(true);
      toastSuccess(msg);
    } catch (err: unknown) {
      toastError(err, 'Gagal mengirim tautan reset');
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[hsl(var(--surface))] lg:min-h-screen lg:flex-row lg:bg-background">
      <div className="hidden w-1/2 flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <AppLogo href="/login" size="lg" imageClassName="brightness-0 invert" priority />
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            Reset password dengan aman.
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-primary-foreground/85">
            Kami akan mengirim tautan reset ke email terdaftar jika akun Anda aktif.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">Kota Depok</p>
      </div>

      <div className="relative shrink-0 overflow-hidden bg-primary px-5 pb-7 pt-[max(1.75rem,env(safe-area-inset-top))] text-primary-foreground lg:hidden">
        <AppLogo href="/login" size="lg" imageClassName="brightness-0 invert" priority />
      </div>

      <div className="flex flex-1 flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 lg:justify-center lg:px-12 lg:py-12">
        <div className="mx-auto w-full max-w-sm rounded-2xl border border-border/60 bg-card p-6 shadow-sm lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none">
          <div className="mb-6 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">Lupa password</h1>
            <p className="text-sm text-muted-foreground">
              Masukkan email akun Anda untuk menerima tautan reset
            </p>
          </div>

          {done ? (
            <div className="space-y-4">
              <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-foreground">{message}</p>
              <Button asChild className="w-full">
                <Link to="/login">Kembali ke login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="nama@email.com" {...register('email')} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Mengirim...' : 'Kirim tautan reset'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                  Kembali ke login
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
