'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, type ApiResponse } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MutabaahMemberPanel } from '@/components/mutabaah/MutabaahMemberPanel';
import { formatWeekRange, toWeekDateParam } from '@/lib/utils';
import type { EvaluationItem } from '@/lib/types';

const statusLabel: Record<string, string> = {
  HADIR: 'Hadir',
  TIDAK_HADIR: 'Tidak hadir',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
};

export default function EvaluasiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

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
      <PageHeader title={data.group.name} description={`Pekan ${formatWeekRange(data.weekDate)}`} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Kehadiran & mutabaah anggota</CardTitle>
            <p className="text-sm text-muted-foreground">
              Mutabaah ditampilkan untuk pekan evaluasi yang sama ({formatWeekRange(data.weekDate)})
            </p>
          </CardHeader>
          <CardContent className="divide-y px-0 pb-0 pt-0">
            {data.attendances.map((att) => {
              const isOpen = expandedUserId === att.userId;
              return (
                <div key={att.userId}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-muted/40"
                    onClick={() => setExpandedUserId(isOpen ? null : att.userId)}
                  >
                    <span className="text-sm font-medium">{att.user.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {statusLabel[att.status] || att.status}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t bg-muted/20 px-5 py-4">
                      <MutabaahMemberPanel
                        userId={att.userId}
                        groupId={data.group.id}
                        weekDate={data.weekDate}
                        userName={att.user.name}
                        compact
                      />
                      <Link
                        href={`/kelompok/${data.group.id}/anggota/${att.userId}?weekDate=${toWeekDateParam(data.weekDate)}`}
                        className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
                      >
                        Lihat detail anggota (pekan sama)
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
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
                <p className="text-muted-foreground">Catatan pembina</p>
                <p>{data.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
