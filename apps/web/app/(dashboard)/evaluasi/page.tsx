'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { EmptyState, LoadingSkeleton } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import type { EvaluationItem } from '@/lib/types';

export default function EvaluasiPage() {
  const { data, isLoading } = useQuery<EvaluationItem[]>({
    queryKey: ['evaluations'],
    queryFn: async () => (await api.get<ApiResponse<EvaluationItem[]>>('/evaluations')).data.data,
  });

  return (
    <PageContainer>
      <PageHeader
        title="Evaluasi mingguan"
        description="Riwayat form evaluasi kelompok"
        action={
          <Button asChild size="sm">
            <Link href="/evaluasi/isi">
              <Plus className="mr-2 h-4 w-4" />
              Isi evaluasi
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <LoadingSkeleton className="h-64" />
      ) : !data?.length ? (
        <EmptyState title="Belum ada evaluasi" description="Mulai isi evaluasi mingguan kelompok Anda." />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y">
            {data.map((e) => (
              <Link
                key={e.id}
                href={`/evaluasi/${e.id}`}
                className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-muted/30"
              >
                <div>
                  <p className="font-medium">{e.group.name}</p>
                  <p className="text-sm text-muted-foreground">Pekan {formatDate(e.weekDate)}</p>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                    e.isSubmitted
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  {e.isSubmitted ? 'Terkirim' : 'Draft'}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </PageContainer>
  );
}
