import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogOut } from 'lucide-react';
import { changePasswordSchema, type ChangePasswordInput } from '@dakwah/shared';
import { api } from '@/lib/api';
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
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { formatDate } from '@/lib/utils';
import { toastError, toastSuccess } from '@/lib/toast';

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const activeRole = useActiveRole();
  const { totalPoints, logs, showPoints, isLoading } = useMyPoints();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({
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

  const onChangePassword = async (data: ChangePasswordInput) => {
    try {
      await api.post('/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toastSuccess('Password berhasil diubah. Silakan login ulang.');
      reset();
      logout();
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      toastError(err, 'Gagal mengubah password');
    }
  };

  return (
    <PageContainer tight>
      <PageHeader title="Profil" compact />

      {user && (
        <ProfileHeader
          name={user.name}
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
        <AppSectionHeader title="Ganti password" />
        <ListGroup>
          <form onSubmit={handleSubmit(onChangePassword)} className="space-y-4 px-4 py-4 md:px-5">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Password saat ini</Label>
              <PasswordInput id="currentPassword" {...register('currentPassword')} />
              {errors.currentPassword && (
                <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Password baru</Label>
              <PasswordInput id="newPassword" {...register('newPassword')} />
              {errors.newPassword && (
                <p className="text-sm text-destructive">{errors.newPassword.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Konfirmasi password baru</Label>
              <PasswordInput id="confirmPassword" {...register('confirmPassword')} />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan password'}
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
