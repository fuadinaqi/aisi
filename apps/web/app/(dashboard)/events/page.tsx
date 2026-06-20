'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Calendar, ChevronRight, MapPin, Plus, Star } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { AppSectionHeader, ListDivider, ListGroup } from '@/components/layout/AppUI';
import { EmptyState, LoadingSkeleton } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';
import { formatDate, formatEventTargetLevels, getMediaUrl, getPrimaryRole } from '@/lib/utils';
import type { EventItem } from '@/lib/types';

const checkInLabels: Record<string, string> = {
  PENDING: 'Menunggu persetujuan',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
};

export default function EventsPage() {
  const user = useAuthStore((s) => s.user);
  const role = user ? getPrimaryRole(user.roles) : '';
  const canCreate = role === 'SUPERADMIN' || role === 'ADMIN' || role === 'PJ_SEKOLAH';
  const isPembina = role === 'PEMBINA';

  const { data, isLoading } = useQuery<EventItem[]>({
    queryKey: ['events'],
    queryFn: async () => (await api.get<ApiResponse<EventItem[]>>('/events')).data.data,
  });

  const { data: levelConfigs = [] } = useQuery<{ level: string; label: string }[]>({
    queryKey: ['group-levels'],
    queryFn: async () =>
      (await api.get<ApiResponse<{ level: string; label: string }[]>>('/config/group-levels')).data.data,
  });

  const levelLabels = Object.fromEntries(levelConfigs.map((cfg) => [cfg.level, cfg.label]));

  return (
    <PageContainer tight>
      <PageHeader
        title="Agenda"
        compact
        action={
          <div className="flex items-center gap-2">
            {isPembina && (
              <Button asChild size="sm" variant="outline" className="rounded-xl">
                <Link href="/events/check-ins">Persetujuan</Link>
              </Button>
            )}
            {canCreate && (
              <Button asChild size="sm" className="rounded-xl">
                <Link href="/events/new">
                  <Plus className="mr-1 h-4 w-4" />
                  Tambah
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {isLoading ? (
        <LoadingSkeleton className="h-64 rounded-2xl" />
      ) : !data?.length ? (
        <EmptyState
          title="Belum ada agenda aktif"
          description="Event yang sudah berakhir otomatis tidak ditampilkan"
        />
      ) : (
        <section className="space-y-3">
          <AppSectionHeader title={`${data.length} kegiatan aktif`} />
          <ListGroup>
            {data.map((e, i) => {
              const imageUrl = getMediaUrl(e.imageUrl);
              return (
                <div key={e.id}>
                  {i > 0 && <ListDivider />}
                  <Link
                    href={`/events/${e.id}`}
                    className="group/link block px-4 py-4 outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring md:px-5"
                  >
                    <div className="flex items-start gap-3">
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imageUrl}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <Calendar className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium group-hover/link:text-primary">{e.title}</p>
                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover/link:text-primary" />
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {formatDate(e.startAt)} – {formatDate(e.endAt)}
                        </p>
                        {e.school ? (
                          <p className="mt-1 text-xs text-muted-foreground">{e.school.name}</p>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">Semua sekolah</p>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatEventTargetLevels(e.targetLevels, levelLabels)}
                        </p>
                        {e.location && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {e.location}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {e.pointValue > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                              <Star className="h-3 w-3" fill="currentColor" />
                              {e.pointValue} poin
                            </span>
                          )}
                          {e.myCheckIn && (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                              {checkInLabels[e.myCheckIn.status] || e.myCheckIn.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </ListGroup>
        </section>
      )}
    </PageContainer>
  );
}
