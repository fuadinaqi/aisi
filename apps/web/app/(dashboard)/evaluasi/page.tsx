'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { EvaluationInfiniteList } from '@/components/evaluasi/EvaluationInfiniteList';
import { Button } from '@/components/ui/button';

export default function EvaluasiPage() {
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

      <EvaluationInfiniteList
        queryKey={['evaluations']}
        emptyTitle="Belum ada evaluasi"
        emptyDescription="Mulai isi evaluasi mingguan kelompok Anda."
      />
    </PageContainer>
  );
}
