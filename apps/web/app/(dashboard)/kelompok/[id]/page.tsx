'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, type ApiResponse } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PointBadge, LoadingSkeleton } from '@/components/shared/Badges';

export default function KelompokDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: group, isLoading } = useQuery({
    queryKey: ['group', id],
    queryFn: async () => {
      const res = await api.get<ApiResponse>(`/groups/${id}`);
      return res.data.data;
    },
  });

  if (isLoading) return <LoadingSkeleton className="h-64" />;
  if (!group) return <p>Kelompok tidak ditemukan</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">{group.name}</h1>
          <p className="text-sm text-muted-foreground">{group.school.name} · Pembina: {group.pembina.name}</p>
        </div>
        <Link href={`/kelompok/${id}/anggota/undang`}>
          <Button>Undang Anggota</Button>
        </Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Daftar Anggota</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {group.members.map((m: { user: { id: string; name: string; email: string; totalPoints: number } }) => (
            <div key={m.user.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{m.user.name}</p>
                <p className="text-sm text-muted-foreground">{m.user.email}</p>
              </div>
              <PointBadge points={m.user.totalPoints} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
