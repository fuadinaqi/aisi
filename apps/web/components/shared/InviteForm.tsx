'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';

type InviteFormData = {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  useDirectPassword?: boolean;
};

type InviteFormProps = {
  title?: string;
  description?: string;
  submitLabel?: string;
  showPhone?: boolean;
  showPasswordOption?: boolean;
  onSubmit: (data: {
    name: string;
    email: string;
    phone?: string;
    password?: string;
  }) => Promise<void>;
  onCancel?: () => void;
};

export function InviteForm({
  title,
  description,
  submitLabel = 'Kirim undangan',
  showPhone = false,
  showPasswordOption = false,
  onSubmit,
  onCancel,
}: InviteFormProps) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<InviteFormData>();

  const useDirectPassword = watch('useDirectPassword');

  const handleFormSubmit = async (data: InviteFormData) => {
    try {
      setError('');
      setSuccess('');
      await onSubmit({
        name: data.name.trim(),
        email: data.email.trim(),
        phone: data.phone?.trim() || undefined,
        ...(showPasswordOption && data.useDirectPassword && data.password
          ? { password: data.password }
          : {}),
      });
      setSuccess('Berhasil! Cek log API untuk link undangan jika mode undangan.');
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal mengirim undangan',
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {(title || description) && (
        <div className="space-y-1">
          {title && <p className="text-sm font-semibold">{title}</p>}
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      )}

      <div className="space-y-2">
        <Label>Nama lengkap</Label>
        <Input className="rounded-xl" {...register('name', { required: true })} placeholder="Nama lengkap" />
      </div>

      <div className="space-y-2">
        <Label>Email</Label>
        <Input
          type="email"
          className="rounded-xl"
          {...register('email', { required: true })}
          placeholder="email@domain.com"
        />
      </div>

      {showPhone && (
        <div className="space-y-2">
          <Label>No. telepon (opsional)</Label>
          <Input className="rounded-xl" {...register('phone')} placeholder="08xxxxxxxxxx" />
        </div>
      )}

      {showPasswordOption && (
        <>
          <label className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
            <input type="checkbox" className="mt-1" {...register('useDirectPassword')} />
            <span className="text-sm">
              <span className="font-medium">Set password langsung</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Jika tidak dicentang, undangan email akan dikirim.
              </span>
            </span>
          </label>
          {useDirectPassword && (
            <div className="space-y-2">
              <Label>Password</Label>
              <PasswordInput
                className="rounded-xl"
                {...register('password', { required: useDirectPassword })}
                placeholder="Min. 8 karakter, huruf besar & angka"
              />
            </div>
          )}
        </>
      )}

      {error && <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      {success && <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting} className="rounded-xl">
          {isSubmitting ? 'Memproses...' : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" className="rounded-xl" onClick={onCancel}>
            Batal
          </Button>
        )}
      </div>
    </form>
  );
}
