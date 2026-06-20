'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api, type ApiResponse } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getPrimaryRole } from '@/lib/utils';
import { StatCard, LoadingSkeleton } from '@/components/shared/Badges';
import { Users, School, ClipboardList, LayoutGrid } from 'lucide-react';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';

interface AnalyticsOverview {
  scope?: 'city' | 'school';
  totalSchools: number;
  totalGroups: number;
  totalPembina: number;
  totalAnggota: number;
  submissionRate: number;
  evaluationsThisWeek?: number;
  attendanceTrend?: { week: string; rate: number }[];
}

export default function AnalyticsPage() {
  const user = useAuthStore((s) => s.user);
  const role = user ? getPrimaryRole(user.roles) : '';
  const isPj = role === 'PJ_SEKOLAH';

  const { data, isLoading } = useQuery<AnalyticsOverview>({
    queryKey: ['analytics-overview', role],
    queryFn: async () => (await api.get<ApiResponse<AnalyticsOverview>>('/analytics/overview')).data.data,
  });

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH']}>
      <PageContainer tight>
        <PageHeader
          title={isPj ? 'Analitik sekolah' : 'Analitik Depok'}
          description={
            isPj
              ? 'Gambaran umum sekolah yang Anda pegang'
              : 'Ringkasan pembinaan di seluruh Kota Depok'
          }
          compact
        />

        {isLoading ? (
          <LoadingSkeleton className="h-64 rounded-2xl" />
        ) : (
          data && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                <StatCard
                  icon={School}
                  label={isPj ? 'Sekolah saya' : 'Sekolah aktif'}
                  value={data.totalSchools}
                />
                <StatCard icon={LayoutGrid} label="Kelompok aktif" value={data.totalGroups} />
                <StatCard icon={Users} label="Pembina" value={data.totalPembina} />
                <StatCard icon={ClipboardList} label="Submit rate" value={`${data.submissionRate}%`} />
              </div>

              {isPj && (
                <p className="px-0.5 text-sm text-muted-foreground">
                  {data.totalAnggota} anggota · {data.evaluationsThisWeek ?? 0} evaluasi terkirim pekan ini
                </p>
              )}

              {data.attendanceTrend && data.attendanceTrend.length > 0 && (
                <ListGroup className="p-4 md:p-5">
                  <h3 className="mb-4 font-semibold">Tren kehadiran (8 minggu)</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.attendanceTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="week"
                        tickFormatter={(v) =>
                          new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
                        }
                      />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="rate" fill="hsl(160, 84%, 39%)" name="Kehadiran %" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ListGroup>
              )}
            </div>
          )
        )}
      </PageContainer>
    </RoleGuard>
  );
}
