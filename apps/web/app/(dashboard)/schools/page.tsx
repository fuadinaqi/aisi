'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, School } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getPrimaryRole } from '@/lib/utils';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { AppSectionHeader, ListDivider, ListGroup, ListRow } from '@/components/layout/AppUI';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import type { SchoolItem } from '@/lib/types';

export default function SchoolsPage() {
  const user = useAuthStore((s) => s.user);
  const role = user ? getPrimaryRole(user.roles) : '';
  const canCreate = role === 'SUPERADMIN' || role === 'ADMIN';

  const { data, isLoading } = useQuery<SchoolItem[]>({
    queryKey: ['schools'],
    queryFn: async () => (await api.get<ApiResponse<SchoolItem[]>>('/schools?limit=50')).data.data,
  });

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH']}>
      <PageContainer tight>
        <PageHeader
          title="Sekolah"
          compact
          action={
            canCreate ? (
              <Button asChild size="sm" className="rounded-xl">
                <Link href="/schools/new">
                  <Plus className="mr-1 h-4 w-4" />
                  Tambah
                </Link>
              </Button>
            ) : undefined
          }
        />

        {isLoading ? (
          <LoadingSkeleton className="h-64 rounded-2xl" />
        ) : !data?.length ? (
          <div className="space-y-4 px-1">
            <p className="text-sm text-muted-foreground">Belum ada sekolah terdaftar.</p>
            {canCreate && (
              <Button asChild className="rounded-xl">
                <Link href="/schools/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah sekolah pertama
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <section className="space-y-3">
            <AppSectionHeader title={`${data.length} sekolah`} />
            <ListGroup>
              {data.map((s, i) => (
                <div key={s.id}>
                  {i > 0 && <ListDivider />}
                  <ListRow
                    href={`/schools/${s.id}`}
                    icon={School}
                    title={s.name}
                    subtitle={s.city}
                  />
                </div>
              ))}
            </ListGroup>
          </section>
        )}
      </PageContainer>
    </RoleGuard>
  );
}
