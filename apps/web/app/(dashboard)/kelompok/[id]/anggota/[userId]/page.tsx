'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Calendar, Mail, Pencil, Phone, School, Users } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getPrimaryRole } from '@/lib/utils';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup, ProfileHeader } from '@/components/layout/AppUI';
import { AttendanceRate } from '@/components/shared/AttendanceRate';
import { LoadingSkeleton, PointBadge, RoleBadge } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import type { GroupMemberDetail } from '@/lib/types';

const levelLabels: Record<string, string> = {
  LEVEL_1: 'Muda (Level 1)',
  LEVEL_2: 'Pratama (Level 2)',
};

export default function AnggotaDetailPage() {
  const { id, userId } = useParams<{ id: string; userId: string }>();
  const user = useAuthStore((s) => s.user);
  const role = user ? getPrimaryRole(user.roles) : '';
  const canEdit =
    role === 'PEMBINA' || role === 'PJ_SEKOLAH' || role === 'ADMIN' || role === 'SUPERADMIN';

  const { data: member, isLoading } = useQuery<GroupMemberDetail>({
    queryKey: ['group-member', id, userId],
    queryFn: async () =>
      (await api.get<ApiResponse<GroupMemberDetail>>(`/groups/${id}/members/${userId}`)).data.data,
    enabled: !!id && !!userId,
  });

  if (isLoading) {
    return (
      <PageContainer tight>
        <LoadingSkeleton className="h-64 rounded-2xl" />
      </PageContainer>
    );
  }

  if (!member) return null;

  return (
    <PageContainer tight>
      <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
        <Link href={`/kelompok/${id}`}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Kembali ke kelompok
        </Link>
      </Button>

      <PageHeader
        title="Detail anggota"
        compact
        action={
          canEdit ? (
            <Button asChild size="sm" variant="outline" className="rounded-xl">
              <Link href={`/kelompok/${id}/anggota/${userId}/edit`}>
                <Pencil className="mr-1 h-4 w-4" />
                Edit
              </Link>
            </Button>
          ) : undefined
        }
      />

      <ProfileHeader
        name={member.user.name}
        email={member.user.email}
        badge={<RoleBadge role="ANGGOTA" />}
        points={<PointBadge points={member.user.totalPoints} />}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ListGroup className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Kehadiran</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Di kelompok ini</p>
            <AttendanceRate
              rate={member.attendanceRate}
              totalHadir={member.totalHadir}
              totalPekan={member.totalPekan}
            />
          </div>
        </ListGroup>

        <ListGroup className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bergabung</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {formatDate(member.joinedAt)}
          </p>
        </ListGroup>
      </div>

      <ListGroup className="mt-4 divide-y divide-border/60">
        <div className="flex items-start gap-3 px-4 py-4 md:px-5">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="truncate font-medium">{member.user.email}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 px-4 py-4 md:px-5">
          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Telepon</p>
            <p className="font-medium">{member.user.phone || '—'}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 px-4 py-4 md:px-5">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Kelompok</p>
            <p className="font-medium">{member.group.name}</p>
            <p className="text-sm text-muted-foreground">
              {levelLabels[member.group.level] || member.group.level}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 px-4 py-4 md:px-5">
          <School className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Sekolah</p>
            <p className="font-medium">{member.school.name}</p>
          </div>
        </div>
      </ListGroup>

      {member.user.lastLoginAt && (
        <p className="mt-4 px-0.5 text-xs text-muted-foreground">
          Login terakhir: {formatDate(member.user.lastLoginAt)}
        </p>
      )}
    </PageContainer>
  );
}
