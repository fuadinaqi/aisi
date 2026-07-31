import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { RoleGuard } from '@/components/layout/RoleGuard';
import { EmptyState, LoadingSkeleton, PointBadge, RoleBadge } from '@/components/shared/Badges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDate, getRoleLabel, isPointEligibleRole } from '@/lib/utils';
import { toast } from '@/lib/toast';

interface UserItem {
  id: string;
  name: string;
  email: string;
  totalPoints: number;
  isActive: boolean;
  lastLoginAt?: string;
  roles: { role: string }[];
  schools?: { school: { id: string; name: string } }[];
}

interface SchoolItem {
  id: string;
  name: string;
}

const ASSIGNABLE_ROLES = ['ADMIN', 'PJ_SEKOLAH', 'PEMBINA', 'ANGGOTA'] as const;

export default function UsersPage() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<string>('PEMBINA');
  const [schoolId, setSchoolId] = useState('');
  const [alsoAsPembina, setAlsoAsPembina] = useState(true);

  const { data, isLoading } = useQuery<UserItem[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<UserItem[]>>('/users?limit=50');
      return res.data.data;
    },
  });

  const { data: schools } = useQuery<SchoolItem[]>({
    queryKey: ['schools', 'users-assign'],
    queryFn: async () => {
      const res = await api.get<ApiResponse<SchoolItem[]>>('/schools?limit=100');
      return res.data.data;
    },
  });

  const addRole = useMutation({
    mutationFn: async ({
      userId,
      role,
      schoolId,
      alsoAsPembina,
    }: {
      userId: string;
      role: string;
      schoolId?: string;
      alsoAsPembina?: boolean;
    }) => {
      const body: { role: string; schoolId?: string; alsoAsPembina?: boolean } = { role };
      if (schoolId) body.schoolId = schoolId;
      if (role === 'ADMIN' || role === 'PJ_SEKOLAH') body.alsoAsPembina = alsoAsPembina;
      await api.post(`/users/${userId}/roles`, body);
    },
    onSuccess: () => {
      toast.success('Role berhasil ditambahkan');
      qc.invalidateQueries({ queryKey: ['users'] });
      setExpandedId(null);
      setSchoolId('');
      setAlsoAsPembina(true);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Gagal menambahkan role');
    },
  });

  const removeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await api.delete(`/users/${userId}/roles/${role}`);
    },
    onSuccess: () => {
      toast.success('Role berhasil dihapus');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || 'Gagal menghapus role');
    },
  });

  const needsSchool = newRole === 'PJ_SEKOLAH' || newRole === 'PEMBINA' || newRole === 'ANGGOTA';
  const canAlsoPembina = newRole === 'ADMIN' || newRole === 'PJ_SEKOLAH';

  return (
    <RoleGuard allowedRoles={['SUPERADMIN']}>
      <PageContainer>
        <PageHeader
          title="Pengguna"
          description="Kelola akun dan peran pengguna sistem"
          action={
            <Button asChild size="sm">
              <Link to="/users/invite">
                <UserPlus className="mr-2 h-4 w-4" />
                Undang admin
              </Link>
            </Button>
          }
        />

        {isLoading ? (
          <LoadingSkeleton className="h-64" />
        ) : !data?.length ? (
          <EmptyState
            title="Belum ada pengguna"
            description="Undang pengguna baru untuk mulai mengelola tim."
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y">
              {data.map((user) => {
                const roleList = user.roles.map((r) => r.role);
                const isExpanded = expandedId === user.id;
                return (
                  <div key={user.id} className="px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/users/${user.id}`} className="font-medium hover:underline">
                            {user.name}
                          </Link>
                          {!user.isActive && (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              Nonaktif
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {roleList.map((role) => (
                            <span key={role} className="inline-flex items-center gap-1">
                              <RoleBadge role={role} />
                              {role !== 'SUPERADMIN' && roleList.length > 1 && (
                                <button
                                  type="button"
                                  className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                  title={`Hapus role ${getRoleLabel(role)}`}
                                  disabled={removeRole.isPending}
                                  onClick={() => {
                                    if (confirm(`Hapus peran ${getRoleLabel(role)} dari ${user.name}?`)) {
                                      removeRole.mutate({ userId: user.id, role });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                        {user.schools?.[0] && (
                          <p className="text-xs text-muted-foreground">{user.schools[0].school.name}</p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        {isPointEligibleRole(roleList) && <PointBadge points={user.totalPoints} />}
                        {user.lastLoginAt && (
                          <span className="text-xs text-muted-foreground">
                            Login {formatDate(user.lastLoginAt)}
                          </span>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedId(null);
                              return;
                            }
                            const next =
                              ASSIGNABLE_ROLES.find((r) => !roleList.includes(r)) || 'PEMBINA';
                            setExpandedId(user.id);
                            setNewRole(next);
                            setSchoolId('');
                            setAlsoAsPembina(true);
                          }}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Role
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 flex flex-col gap-2 rounded-xl bg-muted/40 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                          <label className="block flex-1 text-xs">
                            <span className="mb-1 block text-muted-foreground">Peran</span>
                            <select
                              value={newRole}
                              onChange={(e) => setNewRole(e.target.value)}
                              className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
                            >
                              {ASSIGNABLE_ROLES.filter((r) => !roleList.includes(r)).map((r) => (
                                <option key={r} value={r}>
                                  {getRoleLabel(r)}
                                </option>
                              ))}
                            </select>
                          </label>
                          {needsSchool && (
                            <label className="block flex-1 text-xs">
                              <span className="mb-1 block text-muted-foreground">
                                Sekolah{newRole === 'ANGGOTA' ? ' (opsional)' : ''}
                              </span>
                              <select
                                value={schoolId}
                                onChange={(e) => setSchoolId(e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
                              >
                                <option value="">—</option>
                                {(schools || []).map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-xl"
                            disabled={
                              addRole.isPending ||
                              ASSIGNABLE_ROLES.every((r) => roleList.includes(r)) ||
                              ((newRole === 'PJ_SEKOLAH' || newRole === 'PEMBINA') && !schoolId)
                            }
                            onClick={() =>
                              addRole.mutate({
                                userId: user.id,
                                role: newRole,
                                schoolId: schoolId || undefined,
                                alsoAsPembina: canAlsoPembina ? alsoAsPembina : undefined,
                              })
                            }
                          >
                            Tambah
                          </Button>
                        </div>
                        {canAlsoPembina && (
                          <label className="flex items-start gap-2 text-xs">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={alsoAsPembina}
                              onChange={(e) => setAlsoAsPembina(e.target.checked)}
                            />
                            <span>
                              <span className="font-medium">Juga jadikan Pembina</span>
                              <span className="mt-0.5 block text-muted-foreground">
                                Default tercentang; bisa di-uncheck.
                              </span>
                            </span>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </PageContainer>
    </RoleGuard>
  );
}
