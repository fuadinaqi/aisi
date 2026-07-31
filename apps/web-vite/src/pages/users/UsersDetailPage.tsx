import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { ListGroup, ProfileHeader } from '@/components/layout/AppUI';
import { LoadingSkeleton, PointBadge, RoleBadge } from '@/components/shared/Badges';
import { ProfileDetailsCard } from '@/components/shared/ProfileDetailsCard';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { Button } from '@/components/ui/button';
import { formatDate, isPointEligibleRole } from '@/lib/utils';

type UserDetail = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  gender?: string | null;
  birthPlace?: string | null;
  birthDate?: string | null;
  address?: string | null;
  hobby?: string | null;
  tiktok?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  socialX?: string | null;
  fatherName?: string | null;
  fatherPhone?: string | null;
  motherName?: string | null;
  motherPhone?: string | null;
  totalPoints: number;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  roles: { role: string }[];
  schools?: { school: { id: string; name: string } }[];
};

export default function UsersDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['users', userId],
    queryFn: async () => (await api.get<ApiResponse<UserDetail>>(`/users/${userId}`)).data.data,
    enabled: !!userId,
    retry: false,
  });

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH', 'PEMBINA']}>
      <PageContainer tight className="max-w-lg">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 mb-1 rounded-xl text-muted-foreground"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Kembali
        </Button>

        <PageHeader title="Detail profil" compact />

        {isLoading ? (
          <LoadingSkeleton className="h-64 rounded-2xl" />
        ) : error || !user ? (
          <ListGroup className="p-5 text-sm text-destructive">
            {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
              'Profil tidak ditemukan atau akses ditolak'}
          </ListGroup>
        ) : (
          <div className="space-y-4">
            <ProfileHeader
              name={user.name}
              email={user.email}
              badge={
                <div className="flex flex-wrap gap-1.5">
                  {user.roles.map((r) => (
                    <RoleBadge key={r.role} role={r.role} />
                  ))}
                  {!user.isActive && (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      Nonaktif
                    </span>
                  )}
                </div>
              }
              points={
                isPointEligibleRole(user.roles.map((r) => r.role)) ? (
                  <PointBadge points={user.totalPoints} />
                ) : undefined
              }
            />

            {!!user.schools?.length && (
              <ListGroup className="px-4 py-3 md:px-5">
                <p className="text-xs text-muted-foreground">Sekolah</p>
                <p className="mt-1 text-sm font-medium">
                  {user.schools.map((s) => s.school.name).join(', ')}
                </p>
              </ListGroup>
            )}

            <ProfileDetailsCard profile={user} />

            <p className="px-0.5 text-xs text-muted-foreground">
              Bergabung {formatDate(user.createdAt)}
              {user.lastLoginAt ? ` · Login terakhir ${formatDate(user.lastLoginAt)}` : ''}
            </p>
          </div>
        )}
      </PageContainer>
    </RoleGuard>
  );
}
