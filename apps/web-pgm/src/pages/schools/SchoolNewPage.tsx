
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { invalidateInvitationQueries, invalidateSchoolQueries } from '@/lib/queryInvalidation';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { GenderSelect } from '@/components/shared/GenderField';
import { toastError, toastSuccess } from '@/lib/toast';
import { PjCandidatePicker } from './PjCandidatePicker';

type FormData = {
  name: string;
  city: string;
  address: string;
  mapsUrl: string;
  pjName: string;
  pjEmail: string;
  pjPhone: string;
  pjGender: 'IKHWAN' | 'AKHWAT';
  pjPassword: string;
  useDirectPassword: boolean;
  alsoAsPembina: boolean;
  pjMode: 'existing' | 'new';
  pjUserId: string;
};

export default function NewSchoolPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({
    defaultValues: {
      city: 'Depok',
      pjGender: 'IKHWAN',
      useDirectPassword: false,
      alsoAsPembina: true,
      pjMode: 'new',
      pjUserId: '',
    },
  });

  const useDirectPassword = watch('useDirectPassword');
  const pjMode = watch('pjMode');
  const pjUserId = watch('pjUserId');

  const onSubmit = async (data: FormData) => {
    try {
      setError('');
      setSuccess('');

      if (data.pjMode === 'existing' && !data.pjUserId) {
        setError('Pilih user yang akan dijadikan Pengurus PGM');
        return;
      }

      const payload = {
        name: data.name.trim(),
        city: data.city.trim() || 'Depok',
        address: data.address.trim() || undefined,
        mapsUrl: data.mapsUrl.trim() || undefined,
        pj:
          data.pjMode === 'existing'
            ? {
                userId: data.pjUserId,
                alsoAsPembina: data.alsoAsPembina,
              }
            : {
                name: data.pjName.trim(),
                email: data.pjEmail.trim(),
                phone: data.pjPhone.trim() || undefined,
                gender: data.pjGender,
                alsoAsPembina: data.alsoAsPembina,
                ...(data.useDirectPassword && data.pjPassword ? { password: data.pjPassword } : {}),
              },
      };

      const res = await api.post('/schools', payload);
      await invalidateSchoolQueries(queryClient);
      await invalidateInvitationQueries(queryClient);

      const mode = res.data?.data?.mode;
      const successMessage =
        mode === 'direct'
          ? 'PGM dan akun Pengurus PGM berhasil dibuat.'
          : mode === 'existing'
            ? 'PGM berhasil dibuat. Pengurus dipilih dari user yang sudah ada.'
            : 'PGM berhasil dibuat. Undangan aktivasi pengurus telah dikirim (cek log API jika dev).';
      setSuccess(successMessage);
      toastSuccess('PGM berhasil dibuat');

      setTimeout(() => navigate('/schools'), 1500);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal membuat PGM',
      );
      toastError(err, 'Gagal membuat PGM');
    }
  };

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN']}>
      <PageContainer tight className="max-w-lg">
        <PageHeader
          title="Tambah PGM"
          compact
          action={
            <Button asChild variant="ghost" size="sm" className="rounded-xl">
              <Link to="/schools">
                <ArrowLeft className="mr-1 h-4 w-4" />
                Kembali
              </Link>
            </Button>
          }
        />

        <ListGroup className="p-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Data PGM</p>
              <p className="text-xs text-muted-foreground">PGM baru akan langsung terdaftar di sistem.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nama PGM</Label>
              <Input
                id="name"
                placeholder="PGM Limo"
                className="rounded-xl"
                {...register('name', { required: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">Kota</Label>
              <Input id="city" className="rounded-xl" {...register('city')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Alamat PGM (opsional)</Label>
              <textarea
                id="address"
                rows={2}
                placeholder="Jl. ..."
                className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                {...register('address')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mapsUrl">Link Google Maps (opsional)</Label>
              <Input
                id="mapsUrl"
                placeholder="https://maps.google.com/..."
                className="rounded-xl"
                {...register('mapsUrl')}
              />
            </div>

              <div className="border-t border-border/60 pt-5">
              <div className="mb-4 space-y-1">
                <p className="text-sm font-semibold">Pengurus PGM</p>
                <p className="text-xs text-muted-foreground">
                  Pilih user yang sudah ada (Pembina ke atas), atau buat akun pengurus baru bersama PGM ini.
                </p>
              </div>

              <div className="mb-4 flex gap-2">
                <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-border/60 p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input type="radio" value="existing" {...register('pjMode')} />
                  <span className="text-sm">Pilih user</span>
                </label>
                <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border border-border/60 p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input type="radio" value="new" {...register('pjMode')} />
                  <span className="text-sm">Buat akun baru</span>
                </label>
              </div>

              {pjMode === 'existing' ? (
                <div className="space-y-4">
                  <PjCandidatePicker
                    value={pjUserId}
                    onChange={(next) => setValue('pjUserId', next, { shouldValidate: true })}
                    targetSchoolName={watch('name') || 'PGM ini'}
                  />
                  <label className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
                    <input type="checkbox" className="mt-1" {...register('alsoAsPembina')} />
                    <span className="text-sm">
                      <span className="font-medium">Juga jadikan Pembina</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Ditambahkan jika user belum punya peran Pembina.
                      </span>
                    </span>
                  </label>
                </div>
              ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pjName">Nama pengurus</Label>
                  <Input
                    id="pjName"
                    placeholder="Nama lengkap"
                    className="rounded-xl"
                    {...register('pjName', { required: pjMode === 'new' })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pjEmail">Email pengurus</Label>
                  <Input
                    id="pjEmail"
                    type="email"
                    placeholder="pengurus@pgm.id"
                    className="rounded-xl"
                    {...register('pjEmail', { required: pjMode === 'new' })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pjGender">Jenis kelamin</Label>
                  <GenderSelect
                    id="pjGender"
                    value={watch('pjGender')}
                    onChange={(next) => setValue('pjGender', next, { shouldValidate: true })}
                  />
                  {errors.pjGender && (
                    <p className="text-sm text-destructive">{errors.pjGender.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pjPhone">No. telepon (opsional)</Label>
                  <Input
                    id="pjPhone"
                    placeholder="08xxxxxxxxxx"
                    className="rounded-xl"
                    {...register('pjPhone')}
                  />
                </div>

                <label className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    {...register('alsoAsPembina')}
                  />
                  <span className="text-sm">
                    <span className="font-medium">Juga jadikan Pembina</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Pengurus PGM ikut mendapat peran Pembina (bisa di-uncheck).
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-xl bg-muted/50 p-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    {...register('useDirectPassword')}
                  />
                  <span className="text-sm">
                    <span className="font-medium">Set password langsung</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Jika tidak dicentang, pengurus akan menerima undangan email untuk buat password sendiri.
                    </span>
                  </span>
                </label>

                {useDirectPassword && (
                  <div className="space-y-2">
                    <Label htmlFor="pjPassword">Password pengurus</Label>
                    <PasswordInput
                      id="pjPassword"
                      placeholder="Min. 8 karakter, huruf besar & angka"
                      className="rounded-xl"
                      {...register('pjPassword', { required: pjMode === 'new' && useDirectPassword })}
                    />
                  </div>
                )}
              </div>
              )}
            </div>

            {error && (
              <div className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
            )}
            {success && (
              <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full rounded-xl">
              {isSubmitting ? 'Menyimpan...' : 'Buat PGM & pengurus'}
            </Button>
          </form>
        </ListGroup>
      </PageContainer>
    </RoleGuard>
  );
}
