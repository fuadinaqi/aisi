'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { api, type ApiResponse } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import type { EvaluationItem } from '@/lib/types';

const statusLabel: Record<string, string> = {
  HADIR: 'Hadir',
  TIDAK_HADIR: 'Tidak hadir',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
};

export default function EvaluasiDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading } = useQuery<EvaluationItem>({
    queryKey: ['evaluation', id],
    queryFn: async () => (await api.get<ApiResponse<EvaluationItem>>(`/evaluations/${id}`)).data.data,
  });

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingSkeleton className="h-64" />
      </PageContainer>
    );
  }

  if (!data) return null;

  return (
    <PageContainer>
      <PageHeader
        title={data.group.name}
        description={`Pekan ${formatDate(data.weekDate)}`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Kehadiran anggota</CardTitle>
          </CardHeader>
          <CardContent className="divide-y px-0 pb-0 pt-0">
            {data.attendances.map((att) => (
              <div key={att.userId} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm">{att.user.name}</span>
                <span className="text-sm text-muted-foreground">
                  {statusLabel[att.status] || att.status}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium">{data.isSubmitted ? 'Terkirim' : 'Draft'}</p>
            </div>
            {data.notes && (
              <div>
                <p className="text-muted-foreground">Catatan</p>
                <p>{data.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
