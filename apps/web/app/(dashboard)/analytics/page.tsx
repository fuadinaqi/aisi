'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api, type ApiResponse } from '@/lib/api';
import { StatCard, LoadingSkeleton } from '@/components/shared/Badges';
import { Users, School, ClipboardList } from 'lucide-react';
import { RoleGuard } from '@/components/layout/RoleGuard';

interface AnalyticsOverview {
  totalGroups: number;
  totalPembina: number;
  submissionRate: number;
  attendanceTrend?: { week: string; rate: number }[];
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery<AnalyticsOverview>({
    queryKey: ['analytics-overview'],
    queryFn: async () => (await api.get<ApiResponse<AnalyticsOverview>>('/analytics/overview')).data.data,
  });

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN']}>
      <div className="space-y-6">
        <h1 className="text-xl font-bold md:text-2xl">Analitik Depok</h1>
        {isLoading ? <LoadingSkeleton className="h-64" /> : data && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={School} label="Kelompok Aktif" value={data.totalGroups} />
              <StatCard icon={Users} label="Pembina" value={data.totalPembina} />
              <StatCard icon={ClipboardList} label="Submit Rate" value={`${data.submissionRate}%`} />
            </div>
            {data.attendanceTrend && data.attendanceTrend.length > 0 && (
              <div className="rounded-lg border bg-card p-4">
                <h3 className="mb-4 font-semibold">Tren Kehadiran (8 Minggu)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.attendanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" tickFormatter={(v) => new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="rate" fill="hsl(160, 84%, 39%)" name="Kehadiran %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </RoleGuard>
  );
}
