'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { InvitationStatusBadge, LoadingSkeleton } from '@/components/shared/Badges';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import { invalidateInvitationQueries } from '@/lib/queryInvalidation';
import type { InvitationItem } from '@/lib/types';

export default function InvitationsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<InvitationItem[]>({
    queryKey: ['invitations'],
    queryFn: async () => (await api.get<ApiResponse<InvitationItem[]>>('/invitations')).data.data,
  });

  const resend = async (id: string) => {
    await api.post(`/invitations/${id}/resend`);
    await invalidateInvitationQueries(queryClient);
  };

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH', 'PEMBINA']}>
      <PageContainer>
        <PageHeader title="Undangan" description="Riwayat undangan yang pernah dikirim" />

        {isLoading ? (
          <LoadingSkeleton className="h-64" />
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y">
              {data?.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{inv.name}</p>
                    <p className="truncate text-sm text-muted-foreground">{inv.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {inv.role} · {formatDate(inv.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <InvitationStatusBadge status={inv.status} />
                    {inv.status !== 'USED' && (
                      <Button size="sm" variant="outline" onClick={() => resend(inv.id)}>
                        Kirim ulang
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </PageContainer>
    </RoleGuard>
  );
}
