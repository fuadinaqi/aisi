import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListDivider, ListGroup } from '@/components/layout/AppUI';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';
import { WhatsAppButton } from '@/components/shared/WhatsAppButton';
import { getGenderLabel, getWhatsAppUrl } from '@/lib/utils';
import { toastError, toastSuccess } from '@/lib/toast';
import type { MentorApplicationItem, MentorNeedItem } from '@/lib/types';

function WhatsAppTextLink({ phone }: { phone: string }) {
  const url = getWhatsAppUrl(phone);
  if (!url) return <span>{phone}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-emerald-700 hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {phone}
    </a>
  );
}

const statusLabel: Record<MentorApplicationItem['status'], string> = {
  PENDING: 'Menunggu',
  ACCEPTED: 'Diterima',
  REJECTED: 'Ditolak',
};

export default function KebutuhanMentorApplicationsPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const queryClient = useQueryClient();

  const { data: need } = useQuery<MentorNeedItem>({
    queryKey: ['mentor-need', schoolId],
    queryFn: async () =>
      (await api.get<ApiResponse<MentorNeedItem>>(`/mentor-needs/schools/${schoolId}`)).data.data,
    enabled: !!schoolId,
  });

  const { data, isLoading } = useQuery<MentorApplicationItem[]>({
    queryKey: ['mentor-applications', schoolId],
    queryFn: async () =>
      (
        await api.get<ApiResponse<MentorApplicationItem[]>>(
          `/mentor-needs/schools/${schoolId}/applications`,
        )
      ).data.data,
    enabled: !!schoolId,
  });

  const mutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MentorApplicationItem['status'] }) => {
      await api.patch(`/mentor-needs/applications/${id}`, { status });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mentor-applications', schoolId] });
      await queryClient.invalidateQueries({ queryKey: ['mentor-need', schoolId] });
      await queryClient.invalidateQueries({ queryKey: ['mentor-needs'] });
      toastSuccess('Status diperbarui');
    },
    onError: (err) => toastError(err, 'Gagal memperbarui status'),
  });

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH']}>
      <PageContainer tight>
        <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
          <Link to={`/kebutuhan-mentor/${schoolId}`}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Kembali
          </Link>
        </Button>

        <PageHeader
          title="Pendaftar Mentor"
          compact
          description={need?.schoolName ? `Sekolah ${need.schoolName}` : undefined}
        />

        {isLoading ? (
          <LoadingSkeleton className="h-64 rounded-2xl" />
        ) : !data?.length ? (
          <ListGroup>
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Belum ada pendaftar.
            </div>
          </ListGroup>
        ) : (
          <ListGroup>
            {data.map((app, i) => (
              <div key={app.id}>
                {i > 0 && <ListDivider />}
                <div className="space-y-3 px-4 py-4 md:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{app.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {getGenderLabel(app.gender)} · {app.age} th · {statusLabel[app.status]}
                      </p>
                    </div>
                    <WhatsAppButton phone={app.whatsapp} size="sm" />
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>
                      WA: <WhatsAppTextLink phone={app.whatsapp} />
                    </p>
                    <p>Alamat: {app.address}</p>
                    <p>Asal SMA/SMK: {app.asalSma}</p>
                    <p>
                      Murobbi/ah: {app.murobbiName} (<WhatsAppTextLink phone={app.murobbiWhatsapp} />)
                    </p>
                  </div>
                  {app.status === 'PENDING' ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="rounded-xl"
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ id: app.id, status: 'ACCEPTED' })}
                      >
                        Terima
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        disabled={mutation.isPending}
                        onClick={() => mutation.mutate({ id: app.id, status: 'REJECTED' })}
                      >
                        Tolak
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-xl"
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ id: app.id, status: 'PENDING' })}
                    >
                      Kembalikan ke menunggu
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </ListGroup>
        )}
      </PageContainer>
    </RoleGuard>
  );
}
