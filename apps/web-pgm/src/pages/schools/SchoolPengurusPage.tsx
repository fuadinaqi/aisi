import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, UserMinus, UserPlus } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { RoleGuard, useActiveRole } from '@/components/layout/RoleGuard';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListDivider, ListGroup } from '@/components/layout/AppUI';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { WhatsAppButton } from '@/components/shared/WhatsAppButton';
import { Button } from '@/components/ui/button';
import { invalidateSchoolQueries } from '@/lib/queryInvalidation';
import { toastSuccess } from '@/lib/toast';
import type { SchoolDetail } from '@/lib/types';

export default function SchoolPengurusPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const role = useActiveRole() || '';
  const canManagePj = role === 'SUPERADMIN' || role === 'ADMIN';
  const [pjToRemove, setPjToRemove] = useState<{ id: string; name: string } | null>(null);

  const { data: school, isLoading } = useQuery<SchoolDetail>({
    queryKey: ['school', id],
    queryFn: async () => (await api.get<ApiResponse<SchoolDetail>>(`/schools/${id}`)).data.data,
    enabled: !!id,
  });

  const handleRemovePj = async () => {
    if (!pjToRemove) return;
    await api.delete(`/schools/${id}/pj/${pjToRemove.id}`);
    await invalidateSchoolQueries(queryClient, id);
    toastSuccess('Pengurus berhasil dihapus');
  };

  if (isLoading) {
    return (
      <PageContainer tight>
        <LoadingSkeleton className="h-64 rounded-2xl" />
      </PageContainer>
    );
  }

  if (!school) return null;

  const pjUsers = school.pjUsers ?? [];
  const hasPj = pjUsers.length > 0;
  const canRemovePj = canManagePj && pjUsers.length > 1;

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH']}>
      <PageContainer tight className="max-w-3xl">
        <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
          <Link to={`/schools/${id}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Kembali
          </Link>
        </Button>

        <PageHeader title="Pengurus PGM" description={school.name} compact />

        <div className="flex items-center justify-between px-0.5">
          <p className="text-xs text-muted-foreground">
            {hasPj ? `${pjUsers.length} pengurus terdaftar` : 'Minimal 1 pengurus diperlukan'}
          </p>
          {canManagePj && (
            <Button asChild size="sm" variant={hasPj ? 'outline' : 'default'} className="rounded-xl">
              <Link to={`/schools/${id}/pj/undang`}>
                <UserPlus className="mr-1 h-4 w-4" />
                {hasPj ? 'Tambah pengurus' : 'Undang pengurus'}
              </Link>
            </Button>
          )}
        </div>

        {!hasPj ? (
          <ListGroup>
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Belum ada Pengurus PGM.
              {canManagePj && (
                <>
                  {' '}
                  <Link to={`/schools/${id}/pj/undang`} className="font-medium text-primary">
                    Undang pengurus pertama
                  </Link>
                </>
              )}
            </div>
          </ListGroup>
        ) : (
          <ListGroup>
            {pjUsers.map((pj, i) => (
              <div key={pj.id}>
                {i > 0 && <ListDivider />}
                <div className="flex items-center gap-3 px-4 py-4 md:px-5">
                  <div className="min-w-0 flex-1">
                    <Link to={`/users/${pj.id}`} className="font-medium hover:underline">
                      {pj.name}
                    </Link>
                    <p className="truncate text-sm text-muted-foreground">
                      {[pj.email, pj.phone].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <WhatsAppButton phone={pj.phone} size="sm" />
                    {canManagePj && (
                      <>
                        <Button asChild size="sm" variant="outline" className="h-8 rounded-lg px-2.5 text-xs">
                          <Link to={`/schools/${id}/pj/${pj.id}/ganti`}>Ganti</Link>
                        </Button>
                        {canRemovePj && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
                            onClick={() => setPjToRemove({ id: pj.id, name: pj.name })}
                            aria-label={`Hapus ${pj.name}`}
                          >
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </ListGroup>
        )}

        <ConfirmDialog
          open={!!pjToRemove}
          onOpenChange={(open) => !open && setPjToRemove(null)}
          title="Hapus Pengurus PGM?"
          description={
            pjToRemove
              ? `${pjToRemove.name} akan dihapus dari PGM ini. Akun user tetap ada, hanya keterkaitan dengan PGM yang dilepas.`
              : ''
          }
          confirmLabel="Hapus"
          cancelLabel="Batal"
          destructive
          onConfirm={handleRemovePj}
        />
      </PageContainer>
    </RoleGuard>
  );
}
