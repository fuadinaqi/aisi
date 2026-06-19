'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, UserMinus, UserPlus, Users } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getPrimaryRole } from '@/lib/utils';
import { PageContainer, PageHeader, Section } from '@/components/layout/PageShell';
import { AppSectionHeader, ListDivider, ListGroup, ListRow } from '@/components/layout/AppUI';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { AttendanceRate } from '@/components/shared/AttendanceRate';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import type { SchoolDetail } from '@/lib/types';

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = user ? getPrimaryRole(user.roles) : '';
  const canManagePj = role === 'SUPERADMIN' || role === 'ADMIN';
  const canManageGroups = canManagePj || role === 'PJ_SEKOLAH';

  const [pjToRemove, setPjToRemove] = useState<{ id: string; name: string } | null>(null);

  const { data: school, isLoading } = useQuery<SchoolDetail>({
    queryKey: ['school', id],
    queryFn: async () => (await api.get<ApiResponse<SchoolDetail>>(`/schools/${id}`)).data.data,
    enabled: !!id,
  });

  const handleRemovePj = async () => {
    if (!pjToRemove) return;
    await api.delete(`/schools/${id}/pj/${pjToRemove.id}`);
    await queryClient.invalidateQueries({ queryKey: ['school', id] });
  };

  if (isLoading) {
    return (
      <PageContainer tight>
        <LoadingSkeleton className="h-64 rounded-2xl" />
      </PageContainer>
    );
  }

  if (!school) return null;

  const hasPj = school.pjUsers.length > 0;
  const canRemovePj = canManagePj && school.pjUsers.length > 1;

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH']}>
      <PageContainer tight>
        <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
          <Link href="/schools">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Kembali
          </Link>
        </Button>

        <PageHeader title={school.name} compact />

        <p className="px-0.5 text-sm text-muted-foreground">
          {school.city} · {school.totalGroups} kelompok · {school.totalAnggota} anggota
        </p>

        <Section title="Penanggung Jawab Sekolah">
          <div className="mb-3 flex items-center justify-between px-0.5">
            <p className="text-xs text-muted-foreground">
              {hasPj ? `${school.pjUsers.length} PJ terdaftar` : 'Minimal 1 PJ diperlukan'}
            </p>
            {canManagePj && (
              <Button asChild size="sm" variant={hasPj ? 'outline' : 'default'} className="rounded-xl">
                <Link href={`/schools/${id}/pj/undang`}>
                  <UserPlus className="mr-1 h-4 w-4" />
                  {hasPj ? 'Tambah PJ' : 'Undang PJ'}
                </Link>
              </Button>
            )}
          </div>

          {!hasPj ? (
            <ListGroup>
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                Belum ada PJ Sekolah.
                {canManagePj && (
                  <>
                    {' '}
                    <Link href={`/schools/${id}/pj/undang`} className="font-medium text-primary">
                      Undang PJ pertama
                    </Link>
                  </>
                )}
              </div>
            </ListGroup>
          ) : (
            <ListGroup>
              {school.pjUsers.map((pj, i) => (
                <div key={pj.id}>
                  {i > 0 && <ListDivider />}
                  <div className="flex items-center gap-3 px-4 py-4 md:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{pj.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {[pj.email, pj.phone].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {canManagePj && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button asChild size="sm" variant="outline" className="h-8 rounded-lg px-2.5 text-xs">
                          <Link href={`/schools/${id}/pj/${pj.id}/ganti`}>Ganti</Link>
                        </Button>
                        {canRemovePj && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                            onClick={() => setPjToRemove({ id: pj.id, name: pj.name })}
                            aria-label={`Hapus ${pj.name}`}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </ListGroup>
          )}
        </Section>

        <section className="space-y-3">
          <AppSectionHeader
            title={`Kelompok (${school.totalGroups})`}
            action={
              canManageGroups ? (
                <Button asChild size="sm" className="rounded-xl">
                  <Link href={`/schools/${id}/kelompok/baru`}>
                    <Plus className="mr-1 h-4 w-4" />
                    Tambah
                  </Link>
                </Button>
              ) : undefined
            }
          />

          {school.groups.length === 0 ? (
            <ListGroup>
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                Belum ada kelompok pembinaan.
                {canManageGroups && (
                  <>
                    {' '}
                    <Link href={`/schools/${id}/kelompok/baru`} className="font-medium text-primary">
                      Buat kelompok pertama
                    </Link>
                  </>
                )}
              </div>
            </ListGroup>
          ) : (
            <ListGroup>
              {school.groups.map((g, i) => (
                <div key={g.id}>
                  {i > 0 && <ListDivider />}
                  <ListRow
                    href={`/kelompok/${g.id}`}
                    icon={Users}
                    title={g.name}
                    subtitle={`Pembina: ${g.pembina.name} · ${g._count.members} anggota`}
                    trailing={
                      <AttendanceRate
                        variant="group"
                        rate={g.attendanceRate ?? null}
                        totalHadir={g.totalHadir ?? 0}
                        totalPekan={g.totalPekan ?? 0}
                        totalSlots={g.totalSlots}
                        className="hidden sm:flex"
                      />
                    }
                  />
                </div>
              ))}
            </ListGroup>
          )}
        </section>

        <ConfirmDialog
          open={!!pjToRemove}
          onOpenChange={(open) => !open && setPjToRemove(null)}
          title="Hapus PJ Sekolah?"
          description={
            pjToRemove
              ? `${pjToRemove.name} akan dihapus dari sekolah ini. Akun user tetap ada, hanya keterkaitan dengan sekolah yang dilepas.`
              : ''
          }
          confirmLabel="Hapus"
          cancelLabel="Batal"
          destructive
          onConfirm={handleRemovePj}
        />
      </PageContainer>
    </RoleGuard>
  );
}
