'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api, type ApiResponse } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState, LoadingSkeleton } from '@/components/shared/Badges';
import { formatDate } from '@/lib/utils';

export default function EvaluasiPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['evaluations'],
    queryFn: async () => {
      const res = await api.get<ApiResponse>('/evaluations');
      return res.data.data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold md:text-2xl">Evaluasi Mingguan</h1>
        <Link href="/evaluasi/isi"><Button>Isi Evaluasi</Button></Link>
      </div>
      {isLoading ? <LoadingSkeleton className="h-64" /> : !data?.length ? (
        <EmptyState title="Belum ada evaluasi" description="Mulai isi evaluasi mingguan" />
      ) : (
        <div className="space-y-2">
          {data.map((e: { id: string; weekDate: string; isSubmitted: boolean; group: { name: string } }) => (
            <Link key={e.id} href={`/evaluasi/${e.id}`}>
              <Card className="hover:shadow-md">
                <CardContent className="flex justify-between p-4">
                  <div>
                    <p className="font-medium">{e.group.name}</p>
                    <p className="text-sm text-muted-foreground">Pekan {formatDate(e.weekDate)}</p>
                  </div>
                  <span className={`text-xs font-medium ${e.isSubmitted ? 'text-green-600' : 'text-yellow-600'}`}>
                    {e.isSubmitted ? 'Submitted' : 'Draft'}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
