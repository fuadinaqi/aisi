'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { RoleGuard } from '@/components/layout/RoleGuard';

export default function SchoolsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['schools'],
    queryFn: async () => (await api.get<ApiResponse>('/schools?limit=50')).data.data,
  });

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN']}>
      <div className="space-y-4">
        <h1 className="text-xl font-bold md:text-2xl">Sekolah</h1>
        {isLoading ? <LoadingSkeleton className="h-64" /> : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data?.map((s: { id: string; name: string; city: string }) => (
              <Card key={s.id}><CardContent className="p-4"><p className="font-medium">{s.name}</p><p className="text-sm text-muted-foreground">{s.city}</p></CardContent></Card>
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
