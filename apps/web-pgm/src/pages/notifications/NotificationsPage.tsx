import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { invalidateNotificationQueries } from '@/lib/queryInvalidation';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { AppSectionHeader, ListDivider, ListGroup } from '@/components/layout/AppUI';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingSkeleton } from '@/components/shared/Badges';
import { formatDate } from '@/lib/utils';
import { toastError, toastSuccess } from '@/lib/toast';
import type { NotificationData, NotificationItem } from '@/lib/types';

function notificationHref(n: NotificationItem): string | null {
  switch (n.type) {
    case 'NEW_KKS':
      return n.refId ? `/kks/${n.refId}` : '/kks';
    case 'NEW_EVENT':
      return n.refId ? `/events/${n.refId}` : '/events';
    case 'NEW_MATERI':
      return n.refId ? `/materi/${n.refId}` : '/materi';
    case 'NEW_MENTOR_APPLICATION':
      return n.refId ? `/kebutuhan-mentor/${n.refId}/pendaftar` : '/kebutuhan-mentor';
    case 'POINT_EARNED':
      return '/profile';
    default:
      return null;
  }
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<NotificationData>({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<ApiResponse<NotificationData>>('/notifications')).data.data,
  });

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      await invalidateNotificationQueries(queryClient);
      toastSuccess('Semua notifikasi ditandai dibaca');
    } catch (err: unknown) {
      toastError(err, 'Gagal menandai notifikasi');
    }
  };

  const markOneRead = async (id: string, isRead: boolean) => {
    if (isRead) return;
    try {
      await api.put(`/notifications/${id}/read`);
      await invalidateNotificationQueries(queryClient);
    } catch {
      // non-blocking
    }
  };

  const unreadCount = data?.unreadCount ?? 0;

  return (
    <PageContainer tight>
      <PageHeader
        title="Notifikasi"
        compact
        action={
          unreadCount > 0 ? (
            <Button size="sm" variant="ghost" className="h-8 rounded-lg text-xs" onClick={markAllRead}>
              Tandai dibaca
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingSkeleton className="h-64 rounded-2xl" />
      ) : !data?.items?.length ? (
        <EmptyState title="Tidak ada notifikasi" description="Pemberitahuan akan muncul di sini" />
      ) : (
        <section className="space-y-3">
          {unreadCount > 0 && <AppSectionHeader title={`${unreadCount} belum dibaca`} />}
          <ListGroup>
            {data.items.map((n, i) => {
              const href = notificationHref(n);
              const content = (
                <div className={`flex gap-3 px-4 py-4 md:px-5 ${n.isRead ? 'opacity-70' : ''}`}>
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      n.isRead ? 'bg-muted' : 'bg-primary/10'
                    }`}
                  >
                    <Bell className={`h-5 w-5 ${n.isRead ? 'text-muted-foreground' : 'text-primary'}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-medium ${!n.isRead ? 'text-foreground' : ''}`}>{n.title}</p>
                      {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground/80">{formatDate(n.createdAt)}</p>
                  </div>
                </div>
              );

              return (
                <div key={n.id}>
                  {i > 0 && <ListDivider />}
                  {href ? (
                    <Link
                      to={href}
                      className="block transition-colors hover:bg-muted/40"
                      onClick={() => markOneRead(n.id, n.isRead)}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="block w-full text-left transition-colors hover:bg-muted/40"
                      onClick={() => markOneRead(n.id, n.isRead)}
                    >
                      {content}
                    </button>
                  )}
                </div>
              );
            })}
          </ListGroup>
        </section>
      )}
    </PageContainer>
  );
}
