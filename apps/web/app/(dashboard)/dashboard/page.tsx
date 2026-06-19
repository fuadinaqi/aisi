'use client';

import { useQuery } from '@tanstack/react-query';
import { Users, School, ClipboardList, Star } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getPrimaryRole } from '@/lib/utils';
import { StatCard, LoadingSkeleton } from '@/components/shared/Badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { GroupItem, OverviewData } from '@/lib/types';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const role = user ? getPrimaryRole(user.roles) : 'ANGGOTA';

  const { data: overview, isLoading } = useQuery<OverviewData | null>({
    queryKey: ['analytics', role],
    queryFn: async () => {
      if (role === 'SUPERADMIN' || role === 'ADMIN') {
        const res = await api.get<ApiResponse<OverviewData>>('/analytics/overview');
        return res.data.data;
      }
      if (role === 'PEMBINA') {
        const res = await api.get<ApiResponse<GroupItem[]>>('/groups?limit=5');
        return { groups: res.data.data } as OverviewData;
      }
      return null;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <LoadingSkeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold md:text-2xl">Assalamu&apos;alaikum, {user?.name}</h1>
        <p className="text-sm text-muted-foreground">Dashboard {role.replace('_', ' ')}</p>
      </div>

      {(role === 'SUPERADMIN' || role === 'ADMIN') && overview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Users} label="Total Pembina" value={overview.totalPembina} />
          <StatCard icon={School} label="Total Kelompok" value={overview.totalGroups} />
          <StatCard icon={Users} label="Total Anggota" value={overview.totalAnggota} />
          <StatCard icon={ClipboardList} label="Evaluasi Pekan Ini" value={`${overview.submissionRate}%`} sub={`${overview.evaluationsThisWeek} terisi`} />
        </div>
      )}

      {role === 'PEMBINA' && overview?.groups && (
        <Card>
          <CardHeader><CardTitle>Kelompok Saya</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {overview.groups.map((g) => (
              <div key={g.id} className="flex justify-between rounded-lg border p-3">
                <span className="font-medium">{g.name}</span>
                <span className="text-sm text-muted-foreground">{g._count.members} anggota</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {role === 'ANGGOTA' && user && (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard icon={Star} label="Point Saya" value={user.totalPoints} />
        </div>
      )}

      {role === 'PJ_SEKOLAH' && (
        <Card>
          <CardHeader><CardTitle>Overview Sekolah</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">Lihat detail di menu Kelompok dan Pembina</p></CardContent>
        </Card>
      )}
    </div>
  );
}
