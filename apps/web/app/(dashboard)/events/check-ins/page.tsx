'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListDivider, ListGroup } from '@/components/layout/AppUI';
import { EmptyState, LoadingSkeleton } from '@/components/shared/Badges';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { formatDate, getMediaUrl } from '@/lib/utils';
import { invalidateEventQueries } from '@/lib/queryInvalidation';

type PendingCheckIn = {
  id: string;
  checkedAt: string;
  photoUrl: string;
  user: { id: string; name: string; email: string };
  event: { id: string; title: string; startAt: string; endAt: string; pointValue: number; location?: string };
  group: { id: string; name: string };
};

export default function EventCheckInsPage() {
  const queryClient = useQueryClient();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data = [], isLoading } = useQuery<PendingCheckIn[]>({
    queryKey: ['event-check-ins-pending'],
    queryFn: async () => (await api.get<ApiResponse<PendingCheckIn[]>>('/events/check-ins/pending')).data.data,
  });

  const handleApprove = async (id: string, eventId: string) => {
    try {
      setProcessingId(id);
      setError('');
      await api.post(`/events/check-ins/${id}/approve`);
      await queryClient.invalidateQueries({ queryKey: ['event-check-ins-pending'] });
      await invalidateEventQueries(queryClient, eventId, { includePoints: true });
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal menyetujui check-in',
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string, eventId: string) => {
    try {
      setProcessingId(id);
      setError('');
      await api.post(`/events/check-ins/${id}/reject`, {});
      await queryClient.invalidateQueries({ queryKey: ['event-check-ins-pending'] });
      await invalidateEventQueries(queryClient, eventId, { includePoints: true });
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal menolak check-in',
      );
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <RoleGuard allowedRoles={['PEMBINA']}>
      <PageContainer tight>
        <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
          <Link href="/events">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Kembali ke agenda
          </Link>
        </Button>

        <PageHeader title="Persetujuan check-in" compact />

        {error && (
          <div className="mb-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>
        )}

        {isLoading ? (
          <LoadingSkeleton className="h-64 rounded-2xl" />
        ) : !data.length ? (
          <EmptyState title="Tidak ada check-in menunggu" description="Check-in anggota akan muncul di sini" />
        ) : (
          <ListGroup>
            {data.map((item, i) => {
              const photoUrl = getMediaUrl(item.photoUrl);
              return (
                <div key={item.id}>
                  {i > 0 && <ListDivider />}
                  <div className="space-y-4 px-4 py-4 md:px-5">
                    <div>
                      <p className="font-medium">{item.user.name}</p>
                      <p className="text-sm text-muted-foreground">{item.user.email}</p>
                      <p className="mt-1 text-sm">
                        {item.event.title} · {item.group.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(item.checkedAt)} · {item.event.pointValue} poin jika disetujui
                      </p>
                    </div>

                    {photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoUrl} alt="Foto check-in" className="max-h-56 w-full rounded-2xl object-cover" />
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 rounded-xl"
                        disabled={processingId === item.id}
                        onClick={() => handleReject(item.id, item.event.id)}
                      >
                        Tolak
                      </Button>
                      <Button
                        className="flex-1 rounded-xl"
                        disabled={processingId === item.id}
                        onClick={() => handleApprove(item.id, item.event.id)}
                      >
                        Setujui
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </ListGroup>
        )}
      </PageContainer>
    </RoleGuard>
  );
}
