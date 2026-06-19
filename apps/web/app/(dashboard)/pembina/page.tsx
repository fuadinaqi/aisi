'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { RoleGuard } from '@/components/layout/RoleGuard';

export default function PembinaPage() {
  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => (await api.get<ApiResponse>('/groups')).data.data,
  });

  const pembinaMap = new Map<string, { name: string; groups: string[] }>();
  groups?.forEach((g: { pembina: { id: string; name: string }; name: string }) => {
    const existing = pembinaMap.get(g.pembina.id);
    if (existing) existing.groups.push(g.name);
    else pembinaMap.set(g.pembina.id, { name: g.pembina.name, groups: [g.name] });
  });

  return (
    <RoleGuard allowedRoles={['PJ_SEKOLAH']}>
      <div className="space-y-4">
        <h1 className="text-xl font-bold md:text-2xl">Daftar Pembina</h1>
        {isLoading ? <LoadingSkeleton className="h-64" /> : (
          <div className="space-y-2">
            {Array.from(pembinaMap.values()).map((p, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">Kelompok: {p.groups.join(', ')}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
