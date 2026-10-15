
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { EvaluationInfiniteList } from '@/components/evaluasi/EvaluationInfiniteList';
import { RoleGuard, useActiveRole } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';

const EVALUASI_ROLES = ['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH', 'PEMBINA'];

export default function EvaluasiPage() {
  const role = useActiveRole() || '';
  return (
    <RoleGuard allowedRoles={EVALUASI_ROLES}>
      <PageContainer>
        <PageHeader
          title="Evaluasi mingguan"
          description="Riwayat form evaluasi kelompok"
          action={
            <Button asChild size="sm">
              <Link to="/evaluasi/isi">
                <Plus className="mr-2 h-4 w-4" />
                Isi evaluasi
              </Link>
            </Button>
          }
        />

        <EvaluationInfiniteList
          queryKey={['evaluations', role]}
          emptyTitle="Belum ada evaluasi"
          emptyDescription="Mulai isi evaluasi mingguan kelompok Anda."
        />
      </PageContainer>
    </RoleGuard>
  );
}
