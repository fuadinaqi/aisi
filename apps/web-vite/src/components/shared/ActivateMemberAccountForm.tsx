import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';

type FormData = {
  email: string;
  useDirectPassword?: boolean;
  password?: string;
};

type Props = {
  groupId: string;
  userId: string;
  onSuccess: () => void;
};

export function ActivateMemberAccountForm({ groupId, userId, onSuccess }: Props) {
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = useForm<FormData>({ defaultValues: { useDirectPassword: false } });

  const useDirectPassword = watch('useDirectPassword');

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      const res = await api.post(`/groups/${groupId}/members/${userId}/activate-account`, {
        email: data.email.trim(),
        mode: data.useDirectPassword ? 'direct' : 'invite',
        ...(data.useDirectPassword && data.password ? { password: data.password } : {}),
      });
      toastSuccess(res.data?.message || 'Permintaan aktivasi berhasil');
      onSuccess();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Gagal mengaktifkan akun';
      setError(msg);
      toastError(err, 'Gagal mengaktifkan akun');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Isi email untuk undangan aktivasi atau set password langsung agar anggota bisa login.
      </p>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input
          type="email"
          className="rounded-xl"
          {...register('email', { required: true })}
          placeholder="email@domain.com"
        />
      </div>
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
      {error && (
        <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
      )}
      <Button type="submit" disabled={isSubmitting} className="rounded-xl">
        {isSubmitting ? 'Memproses...' : 'Aktivasi akun'}
      </Button>
    </form>
  );
}
