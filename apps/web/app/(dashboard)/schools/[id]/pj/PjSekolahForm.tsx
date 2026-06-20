'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api } from '@/lib/api';
import { invalidateInvitationQueries, invalidateSchoolQueries } from '@/lib/queryInvalidation';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup } from '@/components/layout/AppUI';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { InviteForm } from '@/components/shared/InviteForm';
import { Button } from '@/components/ui/button';

type Props = {
  replace?: boolean;
  replaceUserId?: string;
  replaceUserName?: string;
};

export function PjSekolahForm({ replace = false, replaceUserId, replaceUserName }: Props) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN']}>
      <PageContainer tight className="max-w-lg">
        <PageHeader
          title={replace ? 'Ganti PJ Sekolah' : 'Tambah PJ Sekolah'}
          compact
          action={
            <Button asChild variant="ghost" size="sm" className="rounded-xl">
              <Link href={`/schools/${id}`}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Kembali
              </Link>
            </Button>
          }
        />

        <ListGroup className="p-5">
          <InviteForm
            title={replace ? 'PJ Sekolah pengganti' : 'PJ Sekolah baru'}
            description={
              replace && replaceUserName
                ? `${replaceUserName} akan diganti. PJ baru akan ditambahkan ke sekolah ini.`
                : replace
                  ? 'PJ lama akan dilepas dari sekolah ini.'
                  : 'PJ baru akan ditambahkan ke sekolah ini. Sekolah dapat memiliki lebih dari satu PJ.'
            }
            submitLabel={replace ? 'Ganti PJ' : 'Tambah PJ Sekolah'}
            showPhone
            showGender
            showPasswordOption
            onCancel={() => router.back()}
            onSubmit={async (data) => {
              await api.post(`/schools/${id}/pj`, {
                ...data,
                replace,
                ...(replaceUserId ? { replaceUserId } : {}),
              });
              await invalidateSchoolQueries(queryClient, id);
              await invalidateInvitationQueries(queryClient);
              router.push(`/schools/${id}`);
            }}
          />
        </ListGroup>
      </PageContainer>
    </RoleGuard>
  );
}
