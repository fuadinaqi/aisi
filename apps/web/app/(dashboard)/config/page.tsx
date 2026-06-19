'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type ApiResponse } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RoleGuard } from '@/components/layout/RoleGuard';

export default function ConfigPage() {
  const { data, refetch } = useQuery<{ level: string; label: string }[]>({
    queryKey: ['group-levels'],
    queryFn: async () => (await api.get<ApiResponse<{ level: string; label: string }[]>>('/config/group-levels')).data.data,
  });
  const [labels, setLabels] = useState<Record<string, string>>({});

  const save = async (level: string) => {
    await api.put('/config/group-levels', { level, label: labels[level] });
    refetch();
  };

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN']}>
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-xl font-bold md:text-2xl">Konfigurasi</h1>
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
      </div>
    </RoleGuard>
  );
}
