'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvitationStatusBadge, LoadingSkeleton } from '@/components/shared/Badges';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { formatDate } from '@/lib/utils';

export default function InvitationsPage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['invitations'],
    queryFn: async () => (await api.get<ApiResponse>('/invitations')).data.data,
  });

  const resend = async (id: string) => {
    await api.post(`/invitations/${id}/resend`);
    refetch();
  };

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH', 'PEMBINA']}>
      <div className="space-y-4">
        <h1 className="text-xl font-bold md:text-2xl">Riwayat Undangan</h1>
        {isLoading ? <LoadingSkeleton className="h-64" /> : (
          <div className="space-y-2">
            {data?.map((inv: { id: string; name: string; email: string; role: string; status: string; createdAt: string }) => (
              <Card key={inv.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="font-medium">{inv.name}</p>
                    <p className="text-sm text-muted-foreground">{inv.email} · {inv.role}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(inv.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <InvitationStatusBadge status={inv.status} />
                    {inv.status !== 'USED' && <Button size="sm" variant="outline" onClick={() => resend(inv.id)}>Resend</Button>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
