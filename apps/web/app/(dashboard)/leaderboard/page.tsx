'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { PointBadge, LoadingSkeleton } from '@/components/shared/Badges';
import { getRoleLabel } from '@/lib/utils';

export default function LeaderboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => (await api.get<ApiResponse>('/points/leaderboard?limit=50')).data.data,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold md:text-2xl">Leaderboard</h1>
      {isLoading ? <LoadingSkeleton className="h-64" /> : (
        <div className="space-y-2">
          {data?.map((u: { id: string; name: string; totalPoints: number; roles: { role: string }[] }, i: number) => (
            <Card key={u.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{getRoleLabel(u.roles[0]?.role || 'ANGGOTA')}</p>
                </div>
                <PointBadge points={u.totalPoints} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
