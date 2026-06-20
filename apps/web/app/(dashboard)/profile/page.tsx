'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
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
import { getPrimaryRole, formatDate } from '@/lib/utils';

export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { totalPoints, logs, showPoints, isLoading } = useMyPoints();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    logout();
    router.push('/login');
  };

  return (
    <PageContainer tight>
      <PageHeader title="Profil" compact />

      {user && (
        <ProfileHeader
          name={user.name}
          email={user.email}
          badge={<RoleBadge role={getPrimaryRole(user.roles)} />}
          points={showPoints ? <PointBadge points={totalPoints} /> : undefined}
        />
      )}

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
