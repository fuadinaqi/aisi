import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import {
  changePasswordSchema,
  updateProfileSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from '@dakwah/shared';
import { api, type ApiResponse } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useActiveRole } from '@/components/layout/RoleGuard';
import { RoleSwitcher } from '@/components/layout/RoleSwitcher';
import { useMyPoints } from '@/hooks/useMyPoints';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import {
  AppSectionHeader,
  ListDivider,
  ListGroup,
  ProfileHeader,
} from '@/components/layout/AppUI';
import { PointBadge, RoleBadge, LoadingSkeleton } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { formatDate } from '@/lib/utils';
import { toastError, toastSuccess } from '@/lib/toast';

type ProfileMe = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  birthPlace?: string | null;
  birthDate?: string | null;
  address?: string | null;
  tiktok?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  socialX?: string | null;
  fatherName?: string | null;
  fatherPhone?: string | null;
  motherName?: string | null;
  motherPhone?: string | null;
  hobby?: string | null;
};

const emptyProfile = (name = ''): UpdateProfileInput => ({
  name,
  phone: '',
  birthPlace: '',
  birthDate: '',
  address: '',
  tiktok: '',
  instagram: '',
  facebook: '',
  socialX: '',
  fatherName: '',
  fatherPhone: '',
  motherName: '',
  motherPhone: '',
  hobby: '',
});

function toFormValues(me?: ProfileMe | null, fallbackName = ''): UpdateProfileInput {
  return {
    name: me?.name || fallbackName || '',
    phone: me?.phone || '',
    birthPlace: me?.birthPlace || '',
    birthDate: me?.birthDate ? me.birthDate.slice(0, 10) : '',
    address: me?.address || '',
    tiktok: me?.tiktok || '',
    instagram: me?.instagram || '',
    facebook: me?.facebook || '',
    socialX: me?.socialX || '',
    fatherName: me?.fatherName || '',
    fatherPhone: me?.fatherPhone || '',
    motherName: me?.motherName || '',
    motherPhone: me?.motherPhone || '',
    hobby: me?.hobby || '',
  };
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const updateUser = useAuthStore((s) => s.updateUser);
  const activeRole = useActiveRole();
  const { totalPoints, logs, showPoints, isLoading } = useMyPoints();

  const { data: me } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: async () => (await api.get<ApiResponse<ProfileMe>>('/users/me')).data.data,
    enabled: !!user,
  });

  const profileForm = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: emptyProfile(user?.name || ''),
  });
  const { reset: resetProfile, register, formState, handleSubmit, watch } = profileForm;

  useEffect(() => {
    if (!me && !user) return;
    resetProfile(toFormValues(me, user?.name || ''));
  }, [me, user, resetProfile]);

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    logout();
    navigate('/login', { replace: true });
  };

  const onUpdateProfile = async (data: UpdateProfileInput) => {
    try {
      const payload = {
        name: data.name.trim(),
        phone: data.phone?.trim() ?? '',
        birthPlace: data.birthPlace?.trim() ?? '',
        birthDate: data.birthDate?.trim() ?? '',
        address: data.address?.trim() ?? '',
        tiktok: data.tiktok?.trim() ?? '',
        instagram: data.instagram?.trim() ?? '',
        facebook: data.facebook?.trim() ?? '',
        socialX: data.socialX?.trim() ?? '',
        fatherName: data.fatherName?.trim() ?? '',
        fatherPhone: data.fatherPhone?.trim() ?? '',
        motherName: data.motherName?.trim() ?? '',
        motherPhone: data.motherPhone?.trim() ?? '',
        hobby: data.hobby?.trim() ?? '',
      };
      const res = await api.put<ApiResponse<ProfileMe>>('/users/me', payload);
      const updated = res.data.data;
      updateUser({ name: updated.name });
      resetProfile(toFormValues(updated));
      toastSuccess(res.data.message || 'Profil berhasil diperbarui');
    } catch (err: unknown) {
      toastError(err, 'Gagal memperbarui profil');
    }
  };

  const onChangePassword = async (data: ChangePasswordInput) => {
    try {
      await api.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toastSuccess('Password berhasil diubah. Silakan login ulang.');
      passwordForm.reset();
      logout();
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      toastError(err, 'Gagal mengubah password');
    }
  };

  const displayName = watch('name') || user?.name || '';
  const err = formState.errors;

  return (
    <PageContainer tight>
      <PageHeader title="Profil" compact />

      {user && (
        <ProfileHeader
          name={displayName}
          email={user.email}
          badge={
            <div className="flex flex-wrap items-center gap-1.5">
              {user.roles.map((r) => (
                <RoleBadge
                  key={r}
                  role={r}
                  className={r === activeRole ? 'ring-2 ring-primary/40' : 'opacity-70'}
                />
              ))}
            </div>
          }
          points={showPoints ? <PointBadge points={totalPoints} /> : undefined}
        />
      )}

      {user && user.roles.length > 1 && (
        <section className="space-y-3">
          <AppSectionHeader title="Ganti peran" />
          <ListGroup>
            <div className="px-4 py-4 md:px-5">
              <RoleSwitcher />
            </div>
          </ListGroup>
        </section>
      )}

      <section className="space-y-3">
        <AppSectionHeader title="Data profil" />
        <ListGroup>
          <form onSubmit={handleSubmit(onUpdateProfile)} className="space-y-5 px-4 py-4 md:px-5">
            <div className="space-y-4">
              <p className="text-xs font-medium text-muted-foreground">Akun</p>
              <Field id="name" label="Nama lengkap" error={err.name?.message}>
                <Input id="name" className="rounded-xl" {...register('name')} />
              </Field>
              <Field id="email" label="Email">
                <Input
                  id="email"
                  className="rounded-xl"
                  value={user?.email || ''}
                  disabled
                  readOnly
                />
                <p className="text-xs text-muted-foreground">Email tidak dapat diubah dari sini.</p>
              </Field>
              <Field id="phone" label="No. telepon (opsional)" error={err.phone?.message}>
                <Input
                  id="phone"
                  className="rounded-xl"
                  {...register('phone')}
                  placeholder="08xxxxxxxxxx"
                />
              </Field>
            </div>

            <div className="space-y-4 border-t border-border/60 pt-5">
              <p className="text-xs font-medium text-muted-foreground">Data diri (opsional)</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="birthPlace" label="Tempat lahir" error={err.birthPlace?.message}>
                  <Input
                    id="birthPlace"
                    className="rounded-xl"
                    {...register('birthPlace')}
                    placeholder="Depok"
                  />
                </Field>
                <Field id="birthDate" label="Tanggal lahir" error={err.birthDate?.message}>
                  <Input
                    id="birthDate"
                    type="date"
                    className="rounded-xl"
                    {...register('birthDate')}
                  />
                </Field>
              </div>
              <Field id="address" label="Alamat" error={err.address?.message}>
                <Input
                  id="address"
                  className="rounded-xl"
                  {...register('address')}
                  placeholder="Alamat lengkap"
                />
              </Field>
              <Field id="hobby" label="Hobi" error={err.hobby?.message}>
                <Input
                  id="hobby"
                  className="rounded-xl"
                  {...register('hobby')}
                  placeholder="Membaca, olahraga, ..."
                />
              </Field>
            </div>

            <div className="space-y-4 border-t border-border/60 pt-5">
              <p className="text-xs font-medium text-muted-foreground">Sosial media (opsional)</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="tiktok" label="TikTok" error={err.tiktok?.message}>
                  <Input
                    id="tiktok"
                    className="rounded-xl"
                    {...register('tiktok')}
                    placeholder="@username atau URL"
                  />
                </Field>
                <Field id="instagram" label="Instagram" error={err.instagram?.message}>
                  <Input
                    id="instagram"
                    className="rounded-xl"
                    {...register('instagram')}
                    placeholder="@username atau URL"
                  />
                </Field>
                <Field id="facebook" label="Facebook" error={err.facebook?.message}>
                  <Input
                    id="facebook"
                    className="rounded-xl"
                    {...register('facebook')}
                    placeholder="username atau URL"
                  />
                </Field>
                <Field id="socialX" label="X (Twitter)" error={err.socialX?.message}>
                  <Input
                    id="socialX"
                    className="rounded-xl"
                    {...register('socialX')}
                    placeholder="@username atau URL"
                  />
                </Field>
              </div>
            </div>

            <div className="space-y-4 border-t border-border/60 pt-5">
              <p className="text-xs font-medium text-muted-foreground">Orang tua (opsional)</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="fatherName" label="Nama ayah" error={err.fatherName?.message}>
                  <Input id="fatherName" className="rounded-xl" {...register('fatherName')} />
                </Field>
                <Field id="fatherPhone" label="No. telepon ayah" error={err.fatherPhone?.message}>
                  <Input
                    id="fatherPhone"
                    className="rounded-xl"
                    {...register('fatherPhone')}
                    placeholder="08xxxxxxxxxx"
                  />
                </Field>
                <Field id="motherName" label="Nama ibu" error={err.motherName?.message}>
                  <Input id="motherName" className="rounded-xl" {...register('motherName')} />
                </Field>
                <Field id="motherPhone" label="No. telepon ibu" error={err.motherPhone?.message}>
                  <Input
                    id="motherPhone"
                    className="rounded-xl"
                    {...register('motherPhone')}
                    placeholder="08xxxxxxxxxx"
                  />
                </Field>
              </div>
            </div>

            <Button type="submit" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? 'Menyimpan...' : 'Simpan profil'}
            </Button>
          </form>
        </ListGroup>
      </section>

      <section className="space-y-3">
        <AppSectionHeader title="Ganti password" />
        <ListGroup>
          <form
            onSubmit={passwordForm.handleSubmit(onChangePassword)}
            className="space-y-4 px-4 py-4 md:px-5"
          >
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Password saat ini</Label>
              <PasswordInput id="currentPassword" {...passwordForm.register('currentPassword')} />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Password baru</Label>
              <PasswordInput id="newPassword" {...passwordForm.register('newPassword')} />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Konfirmasi password baru</Label>
              <PasswordInput id="confirmPassword" {...passwordForm.register('confirmPassword')} />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {passwordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
              {passwordForm.formState.isSubmitting ? 'Menyimpan...' : 'Simpan password'}
            </Button>
          </form>
        </ListGroup>
      </section>

      {showPoints && (
        <section className="space-y-3">
          <AppSectionHeader title="Riwayat poin" />
          <ListGroup>
            {isLoading ? (
              <div className="p-5">
                <LoadingSkeleton className="h-24 rounded-xl" />
              </div>
            ) : !logs.length ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                Belum ada riwayat poin
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={log.id}>
                  {i > 0 && <ListDivider />}
                  <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-5">
                    <div className="min-w-0">
                      <p className="font-medium">{log.description}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(log.createdAt)}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-amber-600">
                      +{log.points}
                    </span>
                  </div>
                </div>
              ))
            )}
          </ListGroup>
        </section>
      )}

      <Button
        variant="outline"
        className="mt-6 w-full rounded-xl text-muted-foreground md:hidden"
        onClick={handleLogout}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Keluar
      </Button>
    </PageContainer>
  );
}
