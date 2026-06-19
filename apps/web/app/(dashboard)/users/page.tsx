'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { EmptyState, LoadingSkeleton, PointBadge, RoleBadge } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDate, getPrimaryRole, isPointEligibleRole } from '@/lib/utils';

interface UserItem {
  id: string;
  name: string;
  email: string;
  totalPoints: number;
  isActive: boolean;
  lastLoginAt?: string;
  roles: { role: string }[];
  schools?: { school: { name: string } }[];
}

export default function UsersPage() {
  const { data, isLoading } = useQuery<UserItem[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<UserItem[]>>('/users?limit=50');
      return res.data.data;
    },
  });

  return (
    <RoleGuard allowedRoles={['SUPERADMIN']}>
      <PageContainer>
        <PageHeader
          title="Pengguna"
          description="Kelola akun pengguna sistem"
          action={
            <Button asChild size="sm">
              <Link href="/users/invite">
                <UserPlus className="mr-2 h-4 w-4" />
                Undang admin
              </Link>
            </Button>
          }
        />

        {isLoading ? (
          <LoadingSkeleton className="h-64" />
        ) : !data?.length ? (
          <EmptyState
            title="Belum ada pengguna"
            description="Undang pengguna baru untuk mulai mengelola tim."
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y">
              {data.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{user.name}</p>
                      <RoleBadge role={getPrimaryRole(user.roles.map((r) => r.role))} />
                      {!user.isActive && (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          Nonaktif
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                    {user.schools?.[0] && (
                      <p className="text-xs text-muted-foreground">{user.schools[0].school.name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {isPointEligibleRole(user.roles.map((r) => r.role)) && (
                      <PointBadge points={user.totalPoints} />
                    )}
                    {user.lastLoginAt && (
                      <span className="text-xs text-muted-foreground">
                        Login {formatDate(user.lastLoginAt)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </PageContainer>
    </RoleGuard>
  );
}
