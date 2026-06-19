'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingSkeleton } from '@/components/shared/Badges';
import { formatDate } from '@/lib/utils';

export default function NotificationsPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<ApiResponse>('/notifications')).data.data,
  });

  const markAllRead = async () => {
    await api.put('/notifications/read-all');
    refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold md:text-2xl">Notifikasi</h1>
        {data?.unreadCount > 0 && <Button size="sm" variant="outline" onClick={markAllRead}>Tandai semua dibaca</Button>}
      </div>
      {isLoading ? <LoadingSkeleton className="h-64" /> : !data?.items?.length ? (
        <EmptyState title="Tidak ada notifikasi" />
      ) : (
        <div className="space-y-2">
          {data.items.map((n: { id: string; title: string; body: string; isRead: boolean; createdAt: string }) => (
            <Card key={n.id} className={n.isRead ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(n.createdAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
