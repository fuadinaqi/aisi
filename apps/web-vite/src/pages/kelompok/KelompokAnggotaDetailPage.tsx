
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Mail, Pencil, Phone, School, Users } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { useActiveRole } from '@/components/layout/RoleGuard';
import { cn } from '@/lib/utils';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup, ProfileHeader } from '@/components/layout/AppUI';
import { AttendanceRate } from '@/components/shared/AttendanceRate';
import { LoadingSkeleton, PointBadge, RoleBadge } from '@/components/shared/Badges';
import { getGroupGenderTheme } from '@/components/shared/GenderField';
import { Button } from '@/components/ui/button';
import { formatDate, formatWeekRange, toDateInputValue } from '@/lib/utils';
import { MutabaahMemberPanel } from '@/components/mutabaah/MutabaahMemberPanel';
import { ICMemberPanel } from '@/components/ic/ICMemberPanel';
import type { GroupMemberDetail } from '@/lib/types';
import { useGroupLevelLabels } from '@/hooks/useGroupLevelLabels';

export default function AnggotaDetailPage() {
  const { id = '', userId = '' } = useParams<{ id: string; userId: string }>();
  const [searchParams] = useSearchParams();
  const role = useActiveRole() || '';
  const canEdit =
    role === 'PEMBINA' || role === 'PJ_SEKOLAH' || role === 'ADMIN' || role === 'SUPERADMIN';
  const canViewIC = role !== 'ANGGOTA';
  const canCheckIC = role === 'PEMBINA';
  const [mutabaahWeek, setMutabaahWeek] = useState(
    searchParams.get('weekDate') || toDateInputValue(),
  );
  const { getLevelLabel } = useGroupLevelLabels();

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

  const group = member.group ?? { id: id || '', name: '-', level: 'LEVEL_1', gender: 'IKHWAN' };
  const school = member.school ?? { id: '', name: '-' };
  const memberUser = member.user ?? { id: userId || '', name: '-', email: '', phone: null as string | null, totalPoints: 0, lastLoginAt: null as string | null };
  const groupGender = group.gender ?? 'IKHWAN';
  const theme = getGroupGenderTheme(groupGender);
  const cardClass = cn('p-4', theme.card);
  const cardLabelClass = cn('text-xs font-medium uppercase tracking-wide', theme.cardLabel);

  return (
    <PageContainer tight className={cn('relative', theme.pageGlow)}>
      <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
        <Link to={`/kelompok/${id}`}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Kembali ke kelompok
        </Link>
      </Button>

      <div className={cn('relative mb-4 overflow-hidden rounded-2xl px-4 py-3.5', theme.banner)}>
        <div>
          <p className={cn('text-sm font-semibold', theme.bannerTitleClass)}>{memberUser.name}</p>
          <p className={cn('mt-0.5 text-xs', theme.bannerSubtitle)}>
            {theme.bannerTitle} · {group.name}
          </p>
        </div>
      </div>

      <PageHeader
        title="Detail anggota"
        compact
        action={
          canEdit ? (
            <Button asChild size="sm" variant="outline" className={cn('rounded-xl', theme.outlineButton)}>
              <Link to={`/kelompok/${id}/anggota/${userId}/edit`}>
                <Pencil className="mr-1 h-4 w-4" />
                Edit
              </Link>
            </Button>
          ) : undefined
        }
      />

      <ProfileHeader
        name={memberUser.name}
        email={memberUser.email}
        badge={<RoleBadge role="ANGGOTA" />}
        points={<PointBadge points={memberUser.totalPoints ?? 0} />}
        className={theme.card}
        avatarClassName={theme.profileAvatar}
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ListGroup className={cardClass}>
          <p className={cardLabelClass}>Kehadiran</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Di kelompok ini</p>
            <AttendanceRate
              rate={member.attendanceRate}
              totalHadir={member.totalHadir}
              totalPekan={member.totalPekan}
            />
          </div>
        </ListGroup>

        <ListGroup className={cardClass}>
          <p className={cardLabelClass}>Bergabung</p>
          <p className="mt-2 flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            {formatDate(member.joinedAt)}
          </p>
        </ListGroup>
      </div>

      <ListGroup className={cn('mt-4 divide-y divide-border/60', theme.card)}>
        <div className="flex items-start gap-3 px-4 py-4 md:px-5">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="truncate font-medium">{memberUser.email}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 px-4 py-4 md:px-5">
          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Telepon</p>
            <p className="font-medium">{memberUser.phone || '—'}</p>
          </div>
        </div>
        <div className="flex items-start gap-3 px-4 py-4 md:px-5">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Kelompok</p>
            <p className="font-medium">{group.name}</p>
            <p className="text-sm text-muted-foreground">
              {getLevelLabel(group.level)}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 px-4 py-4 md:px-5">
          <School className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Sekolah</p>
            <p className="font-medium">{school.name}</p>
          </div>
        </div>
      </ListGroup>

      <ListGroup className={cn('mt-4 p-4', theme.card)}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className={cardLabelClass}>Mutabaah yaumiyah</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Laporan ibadah harian anggota per pekan · {formatWeekRange(mutabaahWeek)}
            </p>
          </div>
          <input
            type="date"
            value={mutabaahWeek}
            max={toDateInputValue()}
            onChange={(e) => setMutabaahWeek(e.target.value)}
            className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
          />
        </div>
        <MutabaahMemberPanel
          userId={userId}
          groupId={id}
          weekDate={mutabaahWeek}
          userName={memberUser.name}
        />
      </ListGroup>

      {canViewIC && (
        <ListGroup className={cn('mt-4 p-4', theme.card)}>
          <ICMemberPanel userId={userId} groupId={id} canEdit={canCheckIC} />
        </ListGroup>
      )}

      {memberUser.lastLoginAt && (
        <p className="mt-4 px-0.5 text-xs text-muted-foreground">
          Login terakhir: {formatDate(memberUser.lastLoginAt)}
        </p>
      )}
    </PageContainer>
  );
}
