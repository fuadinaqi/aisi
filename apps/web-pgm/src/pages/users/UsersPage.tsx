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
import { Input } from '@/components/ui/input';
import { formatDate, getRoleLabel, isPointEligibleRole } from '@/lib/utils';
import { SearchableSelect } from '@/components/ui/searchable-select';
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

function roleOptionsFor(roleList: string[]) {
  const missing = ASSIGNABLE_ROLES.filter((r) => !roleList.includes(r));
  if (roleList.includes('PEMBINA') && !missing.includes('PEMBINA')) {
    return [...missing, 'PEMBINA' as const];
  }
  return missing;
}

export default function UsersPage() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<string>('PEMBINA');
  const [schoolId, setSchoolId] = useState('');
  const [alsoAsPembina, setAlsoAsPembina] = useState(true);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery<UserItem[]>({
    queryKey: ['users', search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100' });
      const q = search.trim();
      if (q) params.set('search', q);
      const res = await api.get<ApiResponse<UserItem[]>>(`/users?${params}`);
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
      const res = await api.post<ApiResponse<UserItem>>(`/users/${userId}/roles`, body);
      return res.data.message || 'Role berhasil ditambahkan';
    },
    onSuccess: (message) => {
      toast.success(message);
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['school-pembina'] });
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

        <div className="mb-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau email..."
            aria-label="Cari pengguna"
          />
        </div>

        {isLoading ? (
          <LoadingSkeleton className="h-64" />
        ) : !data?.length ? (
          <EmptyState
            title={search.trim() ? 'Pengguna tidak ditemukan' : 'Belum ada pengguna'}
            description={
              search.trim()
                ? 'Coba kata kunci lain.'
                : 'Undang pengguna baru untuk mulai mengelola tim.'
            }
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y">
              {data.map((user) => {
                const roleList = user.roles.map((r) => r.role);
                const isExpanded = expandedId === user.id;
                const options = roleOptionsFor(roleList);
                const alreadyPembina = roleList.includes('PEMBINA');
                const attachingPembinaSchool = newRole === 'PEMBINA' && alreadyPembina;
                const schoolOptional =
                  newRole === 'ANGGOTA' || (newRole === 'PEMBINA' && !alreadyPembina);
                const linkedSchoolIds = new Set((user.schools || []).map((s) => s.school.id));
                const schoolChoices = (schools || []).filter(
                  (s) => !(attachingPembinaSchool && linkedSchoolIds.has(s.id)),
                );
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
                        {user.schools && user.schools.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {user.schools.map((s) => s.school.name).join(' · ')}
                          </p>
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
                            const next = roleOptionsFor(roleList)[0] || 'PEMBINA';
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
                            <SearchableSelect
                              size="sm"
                              value={newRole}
                              onChange={(next) => {
                                setNewRole(next);
                                setSchoolId('');
                              }}
                              options={options.map((r) => ({
                                value: r,
                                label: `${getRoleLabel(r)}${r === 'PEMBINA' && alreadyPembina ? ' (tautan PGM)' : ''}`,
                              }))}
                            />
                          </label>
                          {needsSchool && (
                            <label className="block flex-1 text-xs">
                              <span className="mb-1 block text-muted-foreground">
                                PGM{schoolOptional ? ' (opsional)' : ''}
                              </span>
                              <SearchableSelect
                                size="sm"
                                value={schoolId}
                                onChange={setSchoolId}
                                options={schoolChoices.map((s) => ({ value: s.id, label: s.name }))}
                                placeholder="Pilih PGM"
                                searchPlaceholder="Cari PGM..."
                                emptyOptionLabel="—"
                                emptyText="PGM tidak ditemukan"
                              />
                            </label>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-xl"
                            disabled={
                              addRole.isPending ||
                              options.length === 0 ||
                              (newRole === 'PJ_SEKOLAH' && !schoolId) ||
                              (attachingPembinaSchool && !schoolId)
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
                            {attachingPembinaSchool ? 'Tautkan' : 'Tambah'}
                          </Button>
                        </div>
                        {newRole === 'PEMBINA' && !alreadyPembina && (
                          <p className="text-xs text-muted-foreground">
                            PGM boleh dikosongkan. Pembina bisa belum terikat PGM, atau
                            ditautkan ke beberapa PGM sekaligus.
                          </p>
                        )}
                        {attachingPembinaSchool && (
                          <p className="text-xs text-muted-foreground">
                            Pilih PGM tambahan. Pembina yang sama bisa mengisi di beberapa
                            PGM.
                          </p>
                        )}
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
                                Default tercentang; bisa di-uncheck. Tidak otomatis mengikat ke
                                PGM.
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
