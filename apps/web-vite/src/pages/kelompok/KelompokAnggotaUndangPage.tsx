
import { Link } from 'react-router-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { invalidateGroupQueries, invalidateInvitationQueries } from '@/lib/queryInvalidation';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { InviteForm } from '@/components/shared/InviteForm';
import { Button } from '@/components/ui/button';

export default function UndangAnggotaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return (
    <PageContainer tight className="max-w-lg">
      <PageHeader
        title="Undang anggota"
        compact
        action={
          <Button asChild variant="ghost" size="sm" className="rounded-xl">
            <Link to={`/kelompok/${id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Kembali
            </Link>
          </Button>
        }
      />

      <ListGroup className="p-5">
        <InviteForm
          description="Anggota akan menerima undangan email dan otomatis masuk ke kelompok ini setelah aktivasi."
          submitLabel="Kirim undangan anggota"
          onCancel={() => navigate(-1)}
          onSubmit={async (data) => {
            await api.post('/invitations', { ...data, role: 'ANGGOTA', groupId: id });
            await invalidateGroupQueries(queryClient, { groupId: id });
            await invalidateInvitationQueries(queryClient);
            navigate(`/kelompok/${id}`);
          }}
        />
      </ListGroup>
    </PageContainer>
  );
}
