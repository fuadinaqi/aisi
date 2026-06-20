'use client';

import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { WhatsAppButton } from '@/components/shared/WhatsAppButton';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListDivider, ListGroup } from '@/components/layout/AppUI';
import type { GroupItem } from '@/lib/types';

export default function PembinaPage() {
  const { data: groups, isLoading } = useQuery<GroupItem[]>({
    queryKey: ['groups'],
    queryFn: async () => (await api.get<ApiResponse<GroupItem[]>>('/groups')).data.data,
  });

  const pembinaMap = new Map<string, { name: string; phone?: string | null; groups: string[] }>();
  groups?.forEach((g) => {
    const existing = pembinaMap.get(g.pembina.id);
    if (existing) {
      existing.groups.push(g.name);
      if (!existing.phone && g.pembina.phone) existing.phone = g.pembina.phone;
    } else {
      pembinaMap.set(g.pembina.id, {
        name: g.pembina.name,
        phone: g.pembina.phone,
        groups: [g.name],
      });
    }
  });

  const pembinaList = Array.from(pembinaMap.values());

  return (
    <RoleGuard allowedRoles={['PJ_SEKOLAH']}>
      <PageContainer tight>
        <PageHeader title="Daftar Pembina" compact />
        {isLoading ? (
          <LoadingSkeleton className="h-64 rounded-2xl" />
        ) : pembinaList.length === 0 ? (
          <ListGroup>
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Belum ada pembina terdaftar.
            </div>
          </ListGroup>
        ) : (
          <ListGroup>
            {pembinaList.map((p, i) => (
              <div key={p.name}>
                {i > 0 && <ListDivider />}
                <div className="flex items-center gap-3 px-4 py-4 md:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-sm text-muted-foreground">Kelompok: {p.groups.join(', ')}</p>
                  </div>
                  <WhatsAppButton phone={p.phone} />
                </div>
              </div>
            ))}
          </ListGroup>
        )}
      </PageContainer>
    </RoleGuard>
  );
}
