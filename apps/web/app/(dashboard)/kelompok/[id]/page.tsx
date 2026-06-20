'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronRight, Pencil, UserMinus, UserPlus } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { cn, getPrimaryRole } from '@/lib/utils';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { AppSectionHeader, ListDivider, ListGroup } from '@/components/layout/AppUI';
import { EvaluationInfiniteList } from '@/components/evaluasi/EvaluationInfiniteList';
import { LoadingSkeleton, PointBadge } from '@/components/shared/Badges';
import { getGroupGenderTheme } from '@/components/shared/GenderField';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { AttendanceRate } from '@/components/shared/AttendanceRate';
import { WhatsAppButton } from '@/components/shared/WhatsAppButton';
import { Button } from '@/components/ui/button';
import { invalidateGroupQueries } from '@/lib/queryInvalidation';
import type { GroupItem } from '@/lib/types';

export default function KelompokDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = user ? getPrimaryRole(user.roles) : '';
  const canManageMembers =
    role === 'PEMBINA' || role === 'PJ_SEKOLAH' || role === 'ADMIN' || role === 'SUPERADMIN';

  const [memberToRemove, setMemberToRemove] = useState<{ userId: string; name: string } | null>(null);

  const { data: group, isLoading } = useQuery<GroupItem>({
    queryKey: ['group', id],
    queryFn: async () => (await api.get<ApiResponse<GroupItem>>(`/groups/${id}`)).data.data,
  });

  const { data: levelConfigs = [] } = useQuery<{ level: string; label: string }[]>({
    queryKey: ['group-levels'],
    queryFn: async () =>
      (await api.get<ApiResponse<{ level: string; label: string }[]>>('/config/group-levels')).data.data,
  });

  const levelLabel =
    levelConfigs.find((cfg) => cfg.level === group?.level)?.label || group?.level || '-';

  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    await api.delete(`/groups/${id}/members/${memberToRemove.userId}`);
    await invalidateGroupQueries(queryClient, { groupId: id });
  };

  if (isLoading) {
    return (
      <PageContainer tight>
        <LoadingSkeleton className="h-64 rounded-2xl" />
      </PageContainer>
    );
  }

  if (!group) return null;

  const theme = getGroupGenderTheme(group.gender);
  const cardClass = cn('p-4', theme.card);
  const cardLabelClass = cn('text-xs font-medium uppercase tracking-wide', theme.cardLabel);

  const backHref =
    role === 'PEMBINA' ? '/dashboard' : `/schools/${group.school.id}`;

  return (
    <PageContainer tight className={cn('relative', theme.pageGlow)}>
      <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
        <Link href={backHref}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Kembali
        </Link>
      </Button>

      <div className={cn('relative mb-4 overflow-hidden rounded-2xl px-4 py-3.5', theme.banner)}>
        <div>
          <p className={cn('text-sm font-semibold', theme.bannerTitleClass)}>{theme.bannerTitle}</p>
          <p className={cn('mt-0.5 text-xs', theme.bannerSubtitle)}>
            {group.school.name} · {levelLabel}
          </p>
        </div>
      </div>

      <PageHeader
        title={group.name}
        compact
        action={
          canManageMembers ? (
            <div className="flex items-center gap-2">
              <Button
                asChild
                size="sm"
                variant="outline"
                className={cn('rounded-xl', theme.outlineButton)}
              >
                <Link href={`/kelompok/${id}/edit`}>
                  <Pencil className="mr-1 h-4 w-4" />
                  Edit
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                className={cn('rounded-xl', theme.primaryButton)}
              >
                <Link href={`/kelompok/${id}/anggota/undang`}>
                  <UserPlus className="mr-1 h-4 w-4" />
                  Undang
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      />

      <p className="px-0.5 text-sm text-muted-foreground">{group.school.name}</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ListGroup className={cardClass}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={cardLabelClass}>Pembina</p>
              <p className="mt-1 font-medium">{group.pembina.name}</p>
              {group.pembina.email && (
                <p className="text-sm text-muted-foreground">{group.pembina.email}</p>
              )}
            </div>
            <WhatsAppButton phone={group.pembina.phone} size="sm" />
          </div>
        </ListGroup>

        <ListGroup className={cardClass}>
          <p className={cardLabelClass}>Level</p>
          <p className="mt-1 font-medium">{levelLabel}</p>
        </ListGroup>

        <ListGroup className={cn('flex items-center justify-between', cardClass)}>
          <div>
            <p className={cardLabelClass}>Kehadiran Kelompok</p>
            <p className="mt-1 text-xs text-muted-foreground">Sejak kelompok dibuat</p>
          </div>
          <AttendanceRate
            variant="group"
            rate={group.attendanceRate ?? null}
            totalHadir={group.totalHadir ?? 0}
            totalPekan={group.totalPekan ?? 0}
            totalSlots={group.totalSlots}
          />
        </ListGroup>
      </div>

      <section className="space-y-3">
        <AppSectionHeader title={`Anggota (${group.members?.length ?? 0})`} />
        <ListGroup className={theme.card}>
          {!group.members?.length ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Belum ada anggota.
              {canManageMembers && (
                <>
                  {' '}
                  <Link
                    href={`/kelompok/${id}/anggota/undang`}
                    className={cn('font-medium', theme.inlineLink)}
                  >
                    Undang anggota
                  </Link>
                </>
              )}
            </div>
          ) : (
            group.members.map((m, i) => (
              <div key={m.user.id}>
                {i > 0 && <ListDivider />}
                <div className="flex items-start gap-3 px-4 py-4 md:px-5">
                  <Link
                    href={`/kelompok/${id}/anggota/${m.user.id}`}
                    className="group/link min-w-0 flex-1 rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className={cn('font-medium', theme.memberLink)}>{m.user.name}</p>
                        <p className="truncate text-sm text-muted-foreground">{m.user.email}</p>
                      </div>
                      <ChevronRight
                        className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground', theme.memberChevron)}
                      />
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-border/60 pt-2.5">
                      <p className="text-xs text-muted-foreground">Kehadiran</p>
                      <AttendanceRate
                        rate={m.attendanceRate}
                        totalHadir={m.totalHadir}
                        totalPekan={m.totalPekan}
                      />
                    </div>
                  </Link>
                  <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
                    <WhatsAppButton phone={m.user.phone} size="sm" />
                    <PointBadge points={m.user.totalPoints} />
                    {canManageMembers && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                        onClick={() => setMemberToRemove({ userId: m.user.id, name: m.user.name })}
                        aria-label={`Hapus ${m.user.name}`}
                      >
                        <UserMinus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </ListGroup>
      </section>

      <section className="space-y-3">
        <AppSectionHeader title="Riwayat evaluasi" />
        <EvaluationInfiniteList
          queryKey={['evaluations', 'group', id]}
          params={{ groupId: id }}
          showGroupName={false}
          compact
          emptyTitle="Belum ada evaluasi"
          emptyDescription="Evaluasi mingguan kelompok ini akan muncul di sini."
        />
      </section>

      <ConfirmDialog
        open={!!memberToRemove}
        onOpenChange={(open) => !open && setMemberToRemove(null)}
        title="Hapus anggota?"
        description={
          memberToRemove
            ? `${memberToRemove.name} akan dihapus dari kelompok ini. Tindakan ini bisa dibatalkan dengan mengundang ulang.`
            : ''
        }
        confirmLabel="Hapus"
        cancelLabel="Batal"
        destructive
        onConfirm={handleRemoveMember}
      />
    </PageContainer>
  );
}
