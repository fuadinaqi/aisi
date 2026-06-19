'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingSkeleton } from '@/components/shared/Badges';
import { formatDate } from '@/lib/utils';

export default function EventsPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['events'],
    queryFn: async () => (await api.get<ApiResponse>('/events')).data.data,
  });

  const attend = async (id: string) => {
    await api.post(`/events/${id}/attend`);
    refetch();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold md:text-2xl">Event & Agenda</h1>
      {isLoading ? <LoadingSkeleton className="h-64" /> : !data?.length ? (
        <EmptyState title="Belum ada event" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {data.map((e: { id: string; title: string; description?: string; location?: string; startAt: string; pointValue: number }) => (
            <Card key={e.id}>
              <CardContent className="p-4">
                <h3 className="font-semibold">{e.title}</h3>
                <p className="text-sm text-muted-foreground">{formatDate(e.startAt)}</p>
                {e.location && <p className="text-sm">{e.location}</p>}
                <p className="mt-1 text-xs text-amber-600">+{e.pointValue} point</p>
                <Button size="sm" className="mt-3" onClick={() => attend(e.id)}>Check-in</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
