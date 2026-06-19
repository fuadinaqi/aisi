'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api, type ApiResponse } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, LoadingSkeleton } from '@/components/shared/Badges';

export default function KelompokPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const res = await api.get<ApiResponse>('/groups');
      return res.data.data;
    },
  });

  if (isLoading) return <LoadingSkeleton className="h-64" />;
  if (!data?.length) return <EmptyState title="Belum ada kelompok" />;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold md:text-2xl">Kelompok</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((g: { id: string; name: string; level: string; school: { name: string }; pembina: { name: string }; _count: { members: number } }) => (
          <Link key={g.id} href={`/kelompok/${g.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <h3 className="font-semibold">{g.name}</h3>
                <p className="text-sm text-muted-foreground">{g.school.name}</p>
                <p className="text-sm">Pembina: {g.pembina.name}</p>
                <p className="mt-2 text-xs text-muted-foreground">{g._count.members} anggota · {g.level}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
