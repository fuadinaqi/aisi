'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { invalidateConfigQueries } from '@/lib/queryInvalidation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';

export default function ConfigPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery<{ level: string; label: string }[]>({
    queryKey: ['group-levels'],
    queryFn: async () => (await api.get<ApiResponse<{ level: string; label: string }[]>>('/config/group-levels')).data.data,
  });
  const [labels, setLabels] = useState<Record<string, string>>({});

  const save = async (level: string) => {
    await api.put('/config/group-levels', { level, label: labels[level] });
    await invalidateConfigQueries(queryClient);
  };

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN']}>
      <PageContainer tight className="max-w-lg space-y-4">
        <PageHeader title="Konfigurasi" compact />

        <Card>
          <CardHeader><CardTitle>Label Level Kelompok</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {data?.map((c) => (
              <div key={c.level} className="flex gap-2">
                <Input
                  defaultValue={c.label}
                  onChange={(e) => setLabels((prev) => ({ ...prev, [c.level]: e.target.value }))}
                  placeholder={c.level}
                />
                <Button onClick={() => save(c.level)}>Simpan</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <ListGroup className="p-5">
          <p className="font-medium">Mutabaah Yaumiyah</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Atur poin mutabaah per level kelompok (checkbox, angka, teks, pilihan).
          </p>
          <Button asChild className="mt-4 rounded-xl">
            <Link href="/config/mutabaah">Kelola master mutabaah</Link>
          </Button>
        </ListGroup>

        <ListGroup className="p-5">
          <p className="font-medium">Indikator Capaian</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Atur master IC per level kelompok (kategori, primer/sekunder, materi).
          </p>
          <Button asChild className="mt-4 rounded-xl">
            <Link href="/config/ic">Kelola indikator capaian</Link>
          </Button>
        </ListGroup>
      </PageContainer>
    </RoleGuard>
  );
}
