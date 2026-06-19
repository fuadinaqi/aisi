'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PointBadge, RoleBadge, LoadingSkeleton } from '@/components/shared/Badges';
import { getPrimaryRole } from '@/lib/utils';
import { formatDate } from '@/lib/utils';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);

  const { data, isLoading } = useQuery({
    queryKey: ['points-me'],
    queryFn: async () => (await api.get<ApiResponse>('/points/me')).data.data,
  });

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-xl font-bold md:text-2xl">Profil Saya</h1>
      {user && (
        <Card>
          <CardHeader><CardTitle>{user.name}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <RoleBadge role={getPrimaryRole(user.roles)} />
            <PointBadge points={user.totalPoints} />
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Riwayat Point</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <LoadingSkeleton className="h-32" /> : !data?.logs?.length ? (
            <p className="text-sm text-muted-foreground">Belum ada riwayat point</p>
          ) : (
            <div className="space-y-2">
              {data.logs.map((log: { id: string; points: number; description: string; createdAt: string }) => (
                <div key={log.id} className="flex justify-between border-b py-2 text-sm">
                  <div>
                    <p>{log.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</p>
                  </div>
                  <span className="font-medium text-amber-600">+{log.points}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
