'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  ClipboardList,
  School,
  Users,
  BookOpen,
  Bell,
  BarChart3,
  Settings,
  Star,
} from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getPrimaryRole, getRoleLabel, isPointEligibleRole } from '@/lib/utils';
import { PointBadge, RoleBadge, LoadingSkeleton } from '@/components/shared/Badges';
import { AppLogo } from '@/components/layout/AppLogo';
import { PageContainer } from '@/components/layout/PageShell';
import {
  AppSectionHeader,
  HeroGreeting,
  ListDivider,
  ListGroup,
  ListRow,
  MetricStrip,
  QuickActionGrid,
} from '@/components/layout/AppUI';
import type { GroupItem, OverviewData } from '@/lib/types';

function getQuickActions(role: string) {
  const actions: { href: string; label: string; icon: typeof Calendar }[] = [];

  if (role === 'ANGGOTA') {
    return [
      { href: '/events', label: 'Agenda', icon: Calendar },
      { href: '/notifications', label: 'Notifikasi', icon: Bell },
      { href: '/profile', label: 'Profil', icon: Users },
    ];
  }

  if (role === 'PEMBINA') {
    return [
      { href: '/evaluasi', label: 'Evaluasi', icon: ClipboardList },
      { href: '/events', label: 'Agenda', icon: Calendar },
      { href: '/materi', label: 'Materi', icon: BookOpen },
      { href: '/notifications', label: 'Notifikasi', icon: Bell },
    ];
  }

  if (role === 'PJ_SEKOLAH') {
    return [
      { href: '/schools', label: 'Sekolah', icon: School },
      { href: '/analytics', label: 'Analitik', icon: BarChart3 },
      { href: '/pembina', label: 'Pembina', icon: Users },
      { href: '/events', label: 'Agenda', icon: Calendar },
    ];
  }

  if (role === 'ADMIN') {
    return [
      { href: '/schools', label: 'Sekolah', icon: School },
      { href: '/events', label: 'Agenda', icon: Calendar },
      { href: '/analytics', label: 'Analitik', icon: BarChart3 },
      { href: '/materi', label: 'Materi', icon: BookOpen },
    ];
  }

  if (role === 'SUPERADMIN') {
    return [
      { href: '/schools', label: 'Sekolah', icon: School },
      { href: '/users', label: 'Pengguna', icon: Users },
      { href: '/events', label: 'Agenda', icon: Calendar },
      { href: '/config', label: 'Pengaturan', icon: Settings },
    ];
  }

  return actions;
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const role = user ? getPrimaryRole(user.roles) : 'ANGGOTA';
  const showPoints = user ? isPointEligibleRole(user.roles) : false;
  const quickActions = getQuickActions(role);

  const { data: overview, isLoading } = useQuery<OverviewData | null>({
    queryKey: ['analytics', role],
    queryFn: async () => {
      if (role === 'SUPERADMIN' || role === 'ADMIN' || role === 'PJ_SEKOLAH') {
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
      <PageContainer tight>
        <div className="mb-4 flex justify-center md:hidden">
          <AppLogo href="/dashboard" priority />
        </div>
        <LoadingSkeleton className="h-32 rounded-2xl" />
        <LoadingSkeleton className="h-24 rounded-2xl" />
        <LoadingSkeleton className="h-48 rounded-2xl" />
      </PageContainer>
    );
  }

  return (
    <PageContainer tight>
      <div className="mb-4 flex justify-center md:hidden">
        <AppLogo href="/dashboard" priority />
      </div>
      <HeroGreeting
        name={user?.name?.split(' ')[0] || 'Pengguna'}
        subtitle={getRoleLabel(role)}
        badge={<RoleBadge role={role} className="bg-white/15 text-white ring-white/20" />}
        trailing={
          showPoints && user ? (
            <div className="rounded-2xl bg-white/15 px-3 py-2 text-center backdrop-blur-sm">
              <p className="text-lg font-bold">{user.totalPoints.toLocaleString('id-ID')}</p>
              <p className="text-[10px] text-primary-foreground/75">Poin</p>
            </div>
          ) : undefined
        }
      />

      {quickActions.length > 0 && (
        <section className="space-y-3">
          <AppSectionHeader title="Akses cepat" />
          <QuickActionGrid actions={quickActions} />
        </section>
      )}

      {(role === 'SUPERADMIN' || role === 'ADMIN' || role === 'PJ_SEKOLAH') && overview && (
        <section className="space-y-3">
          <AppSectionHeader title={role === 'PJ_SEKOLAH' ? 'Ringkasan sekolah' : 'Ringkasan'} />
          <MetricStrip
            items={[
              {
                label: role === 'PJ_SEKOLAH' ? 'Sekolah saya' : 'Sekolah',
                value: overview.totalSchools ?? 0,
              },
              { label: 'Pembina', value: overview.totalPembina ?? 0 },
              { label: 'Kelompok', value: overview.totalGroups ?? 0 },
              { label: 'Anggota', value: overview.totalAnggota ?? 0 },
              {
                label: 'Evaluasi',
                value: `${overview.submissionRate ?? 0}%`,
                sub: `${overview.evaluationsThisWeek ?? 0} pekan ini`,
              },
            ]}
          />
        </section>
      )}

      {role === 'PEMBINA' && overview?.groups && overview.groups.length > 0 && (
        <section className="space-y-3">
          <AppSectionHeader title="Kelompok saya" />
          <ListGroup>
            {overview.groups.map((g, i) => (
              <div key={g.id}>
                {i > 0 && <ListDivider />}
                <ListRow
                  href={`/kelompok/${g.id}`}
                  icon={Users}
                  title={g.name}
                  subtitle={`${g._count.members} anggota · ${g.school.name}`}
                />
              </div>
            ))}
          </ListGroup>
        </section>
      )}

      {role === 'PJ_SEKOLAH' && (
        <section className="space-y-3">
          <AppSectionHeader title="Kelola sekolah" />
          <ListGroup>
            <ListRow href="/schools" icon={School} title="Sekolah saya" subtitle="Lihat pembina & kelompok" />
            <ListDivider />
            <ListRow href="/pembina" icon={Users} title="Daftar pembina" subtitle="Pembina di sekolah Anda" />
          </ListGroup>
        </section>
      )}

      {role === 'ANGGOTA' && showPoints && user && (
        <section className="space-y-3">
          <AppSectionHeader title="Poin saya" />
          <ListGroup>
            <ListRow
              href="/profile"
              icon={Star}
              title="Total poin"
              subtitle="Lihat riwayat di profil"
              trailing={<PointBadge points={user.totalPoints} />}
              showChevron
            />
          </ListGroup>
        </section>
      )}
    </PageContainer>
  );
}
