import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Plus, Users } from 'lucide-react';
import { api, type ApiResponse } from '@/lib/api';
import { RoleGuard, useActiveRole } from '@/components/layout/RoleGuard';
import { PageContainer, PageHeader, Section } from '@/components/layout/PageShell';
import { AppSectionHeader, ListDivider, ListGroup, ListRow } from '@/components/layout/AppUI';
import { EvaluationInfiniteList } from '@/components/evaluasi/EvaluationInfiniteList';
import { LoadingSkeleton } from '@/components/shared/Badges';
import { AttendanceRate } from '@/components/shared/AttendanceRate';
import { WhatsAppButton } from '@/components/shared/WhatsAppButton';
import { getGroupGenderTheme } from '@/components/shared/GenderField';
import { cn, formatWeekRange, toWeekDateParam } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { invalidateSchoolQueries } from '@/lib/queryInvalidation';
import { toastError, toastSuccess } from '@/lib/toast';
import type { GroupItem, SchoolDetail } from '@/lib/types';

const PJ_PREVIEW_LIMIT = 3;

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const role = useActiveRole() || '';
  const canManagePj = role === 'SUPERADMIN' || role === 'ADMIN';
  const canManageGroups = canManagePj || role === 'PJ_SEKOLAH';
  const canEditAddress = canManageGroups;

  const [address, setAddress] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  const { data: school, isLoading } = useQuery<SchoolDetail>({
    queryKey: ['school', id],
    queryFn: async () => (await api.get<ApiResponse<SchoolDetail>>(`/schools/${id}`)).data.data,
    enabled: !!id,
  });

  useEffect(() => {
    if (!school) return;
    setAddress(school.address || '');
    setMapsUrl(school.mapsUrl || '');
  }, [school]);

  const handleSaveAddress = async () => {
    if (!id) return;
    setSavingAddress(true);
    try {
      await api.put(`/schools/${id}`, { address, mapsUrl });
      await invalidateSchoolQueries(queryClient, id);
      toastSuccess('Alamat PGM disimpan');
    } catch (err) {
      toastError(err, 'Gagal menyimpan alamat');
    } finally {
      setSavingAddress(false);
    }
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
  const groups = school.groups ?? [];
  const ikhwanGroups = groups.filter((group) => group.gender !== 'AKHWAT');
  const akhwatGroups = groups.filter((group) => group.gender === 'AKHWAT');
  const pjPreview = pjUsers.slice(0, PJ_PREVIEW_LIMIT);
  const weekDate = toWeekDateParam(new Date());

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH']}>
      <PageContainer tight>
        <Button variant="ghost" size="sm" className="-ml-2 mb-1 rounded-xl text-muted-foreground" asChild>
          <Link to="/schools">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Kembali
          </Link>
        </Button>

        <PageHeader title={school.name} compact />

        <p className="px-0.5 text-sm text-muted-foreground">
          {school.city} · {school.totalGroups} kelompok · {school.totalAnggota} anggota
        </p>

        <GroupSection
          schoolId={school.id}
          title="Kelompok Ikhwan"
          gender="IKHWAN"
          groups={ikhwanGroups}
          canManage={canManageGroups}
        />
        <GroupSection
          schoolId={school.id}
          title="Kelompok Akhwat"
          gender="AKHWAT"
          groups={akhwatGroups}
          canManage={canManageGroups}
        />

        <section className="space-y-3">
          <AppSectionHeader
            title="Evaluasi pekan ini"
            action={
              <div className="flex items-center gap-3">
                <Link
                  to={`/laporan?schoolId=${school.id}`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Poster A4
                </Link>
                <Link
                  to={`/schools/${id}/evaluasi`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Lihat semua
                </Link>
              </div>
            }
          />
          <p className="px-0.5 text-xs text-muted-foreground">Pekan {formatWeekRange(weekDate)}</p>
          <EvaluationInfiniteList
            queryKey={['evaluations', 'school', id, 'week']}
            params={{ schoolId: id, weekDate }}
            compact
            emptyTitle="Belum ada evaluasi pekan ini"
            emptyDescription="Evaluasi yang dikirim kelompok pada pekan ini akan muncul di sini."
          />
        </section>

        <section className="space-y-3">
          <AppSectionHeader
            title={`Pengurus PGM (${pjUsers.length})`}
            action={
              <Link to={`/schools/${id}/pengurus`} className="text-xs font-medium text-primary hover:underline">
                Lihat semua
              </Link>
            }
          />
          {pjPreview.length === 0 ? (
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
              {pjPreview.map((pj, i) => (
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
                    <WhatsAppButton phone={pj.phone} size="sm" />
                  </div>
                </div>
              ))}
            </ListGroup>
          )}
        </section>

        <Section title="Alamat & Lokasi">
          {canEditAddress ? (
            <ListGroup className="space-y-3 p-5">
              <div className="space-y-2">
                <Label htmlFor="schoolAddress">Alamat PGM</Label>
                <textarea
                  id="schoolAddress"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Jl. ..."
                  className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="schoolMapsUrl">Link Google Maps</Label>
                <Input
                  id="schoolMapsUrl"
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  placeholder="https://maps.google.com/..."
                  className="rounded-xl"
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="rounded-xl"
                disabled={savingAddress}
                onClick={handleSaveAddress}
              >
                {savingAddress ? 'Menyimpan...' : 'Simpan alamat'}
              </Button>
            </ListGroup>
          ) : (
            <ListGroup className="space-y-2 p-5 text-sm">
              <p className="text-muted-foreground">{school.address || 'Alamat belum diisi'}</p>
              {school.mapsUrl ? (
                <a
                  href={school.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Buka Google Maps
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </ListGroup>
          )}
        </Section>
      </PageContainer>
    </RoleGuard>
  );
}

function GroupSection({
  schoolId,
  title,
  gender,
  groups,
  canManage,
}: {
  schoolId: string;
  title: string;
  gender: 'IKHWAN' | 'AKHWAT';
  groups: GroupItem[];
  canManage: boolean;
}) {
  const theme = getGroupGenderTheme(gender);
  const noun = gender === 'AKHWAT' ? 'akhwat' : 'ikhwan';

  return (
    <section className="space-y-3">
      <AppSectionHeader
        title={`${title} (${groups.length})`}
        action={
          canManage ? (
            <Button asChild size="sm" className={cn('rounded-xl', theme.primaryButton)}>
              <Link to={`/schools/${schoolId}/kelompok/baru?gender=${gender}`} aria-label={`Tambah kelompok ${noun}`}>
                <Plus className="mr-1 h-4 w-4" />
                Tambah kelompok
              </Link>
            </Button>
          ) : undefined
        }
      />

      {groups.length === 0 ? (
        <ListGroup className={theme.card}>
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            Belum ada kelompok {noun}.
            {canManage && (
              <>
                {' '}
                <Link
                  to={`/schools/${schoolId}/kelompok/baru?gender=${gender}`}
                  className={cn('font-medium', theme.inlineLink)}
                >
                  Buat kelompok {noun} pertama
                </Link>
              </>
            )}
          </div>
        </ListGroup>
      ) : (
        <ListGroup className={theme.card}>
          {groups.map((group, i) => (
            <div key={group.id}>
              {i > 0 && <ListDivider />}
              <ListRow
                href={`/kelompok/${group.id}`}
                icon={Users}
                title={group.name}
                subtitle={`Pembina: ${group.pembina?.name ?? '-'} · ${group._count?.members ?? 0} anggota`}
                trailing={
                  <AttendanceRate
                    variant="group"
                    rate={group.attendanceRate ?? null}
                    totalHadir={group.totalHadir ?? 0}
                    totalPekan={group.totalPekan ?? 0}
                    totalSlots={group.totalSlots}
                    className="hidden sm:flex"
                  />
                }
              />
            </div>
          ))}
        </ListGroup>
      )}
    </section>
  );
}
