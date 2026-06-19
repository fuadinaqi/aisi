'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, LoadingSkeleton } from '@/components/shared/Badges';
import { formatDate } from '@/lib/utils';

export default function MateriPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['materi'],
    queryFn: async () => (await api.get<ApiResponse>('/materi')).data.data,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold md:text-2xl">Materi Pekan</h1>
      {isLoading ? <LoadingSkeleton className="h-64" /> : !data?.length ? (
        <EmptyState title="Belum ada materi" />
      ) : (
        <div className="space-y-2">
          {data.map((m: { id: string; title: string; description?: string; weekDate: string }) => (
            <Card key={m.id}>
              <CardContent className="p-4">
                <h3 className="font-semibold">{m.title}</h3>
                <p className="text-sm text-muted-foreground">Pekan {formatDate(m.weekDate)}</p>
                {m.description && <p className="mt-1 text-sm">{m.description}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
