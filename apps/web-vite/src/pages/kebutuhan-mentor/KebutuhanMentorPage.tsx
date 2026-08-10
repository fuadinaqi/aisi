import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Link2, Users } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { AppSectionHeader, ListDivider, ListGroup } from '@/components/layout/AppUI';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';
import { toastError, toastSuccess } from '@/lib/toast';
import type { MentorNeedItem } from '@/lib/types';

async function copyPublicLink() {
  const url = `${window.location.origin}/calon-mentor`;
  try {
    await navigator.clipboard.writeText(url);
    toastSuccess('Link publik disalin');
  } catch {
    toastError(undefined, 'Gagal menyalin link');
  }
}

function QuotaLine({ label, side }: { label: string; side: { filled: number; need: number; remaining: number } }) {
  const full = side.need > 0 && side.remaining === 0;
  return (
    <span
      className={
        full
          ? 'rounded-md bg-destructive/10 px-2 py-0.5 text-xs text-destructive'
          : 'rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800'
      }
    >
      {label}: {side.filled}/{side.need}
    </span>
  );
}

export default function KebutuhanMentorPage() {
  const { data, isLoading } = useQuery<MentorNeedItem[]>({
    queryKey: ['mentor-needs'],
    queryFn: async () => (await api.get<ApiResponse<MentorNeedItem[]>>('/mentor-needs')).data.data,
  });

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH']}>
      <PageContainer tight>
        <PageHeader
          title="Kebutuhan Mentor"
          compact
          description="Publish kebutuhan pembina/mentor per sekolah untuk calon mentor."
          action={
            <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={copyPublicLink}>
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              Salin link publik
            </Button>
          }
        />

        {isLoading ? (
          <LoadingSkeleton className="h-64 rounded-2xl" />
        ) : !data?.length ? (
          <ListGroup>
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              Belum ada sekolah yang dapat dikelola.
            </div>
          </ListGroup>
        ) : (
          <>
            <AppSectionHeader title={`${data.length} sekolah`} />
            <ListGroup>
              {data.map((item, i) => (
                <div key={item.schoolId}>
                  {i > 0 && <ListDivider />}
                  <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:px-5">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="font-medium">{item.schoolName}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.city}
                        {item.isPublished ? ' · Dipublish' : ' · Belum dipublish'}
                        {item.pendingCount ? ` · ${item.pendingCount} menunggu` : ''}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <QuotaLine label="Ikhwan" side={item.quota.ikhwan} />
                        <QuotaLine label="Akhwat" side={item.quota.akhwat} />
                      </div>
                      {item.description ? (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button asChild size="sm" variant="outline" className="rounded-xl">
                        <Link to={`/kebutuhan-mentor/${item.schoolId}`}>Kelola</Link>
                      </Button>
                      {item.id ? (
                        <Button asChild size="sm" variant="ghost" className="rounded-xl">
                          <Link to={`/kebutuhan-mentor/${item.schoolId}/pendaftar`}>
                            <Users className="mr-1 h-3.5 w-3.5" />
                            Pendaftar
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </ListGroup>
          </>
        )}
      </PageContainer>
    </RoleGuard>
  );
}
