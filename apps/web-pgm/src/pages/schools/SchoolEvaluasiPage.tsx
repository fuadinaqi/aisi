import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { EvaluationInfiniteList } from '@/components/evaluasi/EvaluationInfiniteList';
import { Button } from '@/components/ui/button';
import type { SchoolDetail } from '@/lib/types';

export default function SchoolEvaluasiPage() {
  const { id } = useParams<{ id: string }>();
  const { data: school } = useQuery<SchoolDetail>({
    queryKey: ['school', id],
    queryFn: async () => (await api.get<ApiResponse<SchoolDetail>>(`/schools/${id}`)).data.data,
    enabled: !!id,
  });

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH']}>
      <PageContainer tight>
        <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
          <Link to={`/schools/${id}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Kembali
          </Link>
        </Button>

        <PageHeader
          title="Riwayat evaluasi"
          compact
          action={
            <Link to={`/laporan?schoolId=${id}`} className="text-xs font-medium text-primary hover:underline">
              Poster A4
            </Link>
          }
        />
        <p className="px-0.5 text-sm text-muted-foreground">{school?.name || 'PGM'}</p>

        <EvaluationInfiniteList
          queryKey={['evaluations', 'school', id, 'all']}
          params={{ schoolId: id }}
          compact
          emptyTitle="Belum ada evaluasi"
          emptyDescription="Evaluasi dari kelompok di PGM ini akan muncul di sini."
        />
      </PageContainer>
    </RoleGuard>
  );
}
