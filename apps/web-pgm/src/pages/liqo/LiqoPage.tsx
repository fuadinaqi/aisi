import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useActiveRole, RoleGuard } from '@/components/layout/RoleGuard';
import { PageContainer, PageHeader } from '@/components/layout/PageShell';
import { AppSectionHeader, ListGroup } from '@/components/layout/AppUI';
import { EmptyState, LoadingSkeleton } from '@/components/shared/Badges';
import { WhatsAppButton } from '@/components/shared/WhatsAppButton';
import { useGroupLevelLabels } from '@/hooks/useGroupLevelLabels';
import {
  LIQO_STATUS_LABEL,
  attentionSummary,
  fetchLiqo,
  groupHref,
  latePembina,
  lowAttendanceGroups,
  silentGroups,
  streakLabel,
  type LiqoGroup,
  type LiqoStatus,
  type LiqoWeek,
} from '@/lib/liqo';
import { cn, formatDate, formatWeekRange, getGenderLabel } from '@/lib/utils';

const STATUS_CLASS: Record<LiqoStatus, string> = {
  ON_TIME: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  LATE: 'bg-orange-50 text-orange-800 ring-orange-600/15',
  DRAFT: 'bg-amber-50 text-amber-800 ring-amber-600/15',
  MISSING: 'bg-rose-50 text-rose-700 ring-rose-600/15',
};

const DOT_CLASS: Record<string, string> = {
  ON_TIME: 'bg-emerald-500',
  LATE: 'bg-orange-500',
  DRAFT: 'bg-amber-400',
  MISSING: 'bg-rose-500',
  BEFORE: 'bg-muted',
};

const FILTERS: { id: 'ALL' | LiqoStatus; label: string }[] = [
  { id: 'ALL', label: 'Semua' },
  { id: 'MISSING', label: 'Belum' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'LATE', label: 'Terlambat' },
  { id: 'ON_TIME', label: 'Tepat waktu' },
];

function attendanceSentence(week: LiqoWeek) {
  if (week.attendanceRate == null) return 'Belum ada absensi dari laporan yang terkirim.';
  return `Kehadiran ${week.attendanceRate}% · ${week.hadir} hadir · ${week.izin} izin · ${week.sakit} sakit · ${week.tidakHadir} alpa`;
}

function attendanceLabel(group: LiqoGroup) {
  const total = group.hadir + group.izin + group.sakit + group.tidakHadir;
  if (group.status === 'MISSING') return `${group.memberCount} anggota`;
  if (total === 0) return `${group.memberCount} anggota · absensi kosong`;
  const bits = [`${group.hadir}/${total} hadir`];
  if (group.izin) bits.push(`${group.izin} izin`);
  if (group.sakit) bits.push(`${group.sakit} sakit`);
  if (group.tidakHadir) bits.push(`${group.tidakHadir} alpa`);
  return bits.join(' · ');
}

function shiftWeek(weekDate: string, days: number) {
  const [year, month, day] = weekDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function WeekDots({ weeks, thisWeek }: { weeks: string[]; thisWeek: string }) {
  return (
    <div className="mt-2 flex gap-1" aria-hidden>
      {weeks.map((status, index) => (
        <span
          key={`${thisWeek}-${index}`}
          title={formatWeekRange(shiftWeek(thisWeek, (index - (weeks.length - 1)) * 7))}
          className={cn('h-2 w-2 rounded-full', DOT_CLASS[status] || 'bg-muted')}
        />
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: LiqoStatus }) {
  return (
    <span className={cn('inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', STATUS_CLASS[status])}>
      {LIQO_STATUS_LABEL[status]}
    </span>
  );
}

function WeekSummary({
  title,
  caption,
  week,
}: {
  title: string;
  caption: string;
  week: LiqoWeek;
}) {
  const items = [
    { label: 'Laporan', value: `${week.submissionRate}%`, sub: `${week.submitted}/${week.totalGroups}` },
    { label: 'Tepat waktu', value: week.onTime },
    { label: 'Terlambat', value: week.late },
    { label: 'Draft', value: week.draft },
    { label: 'Belum', value: week.missing },
  ];
  return (
    <section className="space-y-2">
      <AppSectionHeader title={title} />
      <p className="px-0.5 text-xs text-muted-foreground">
        {formatWeekRange(week.weekDate)} · {caption}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl bg-card px-3 py-3 shadow-sm ring-1 ring-black/[0.04]">
            <p className="text-lg font-bold leading-none">{item.value}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{item.label}</p>
            {item.sub && <p className="text-[10px] text-muted-foreground/80">{item.sub} kelompok</p>}
          </div>
        ))}
      </div>
      <p className="px-0.5 text-xs text-muted-foreground">{attendanceSentence(week)}</p>
    </section>
  );
}

export default function LiqoPage() {
  const role = useActiveRole() || '';
  const [params, setParams] = useSearchParams();
  const schoolId = params.get('schoolId') || '';
  const statusParam = params.get('status');
  const status: 'ALL' | LiqoStatus = FILTERS.some((filter) => filter.id === statusParam)
    ? (statusParam as 'ALL' | LiqoStatus)
    : 'ALL';
  const { getLevelLabel } = useGroupLevelLabels();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics', 'liqo', role, schoolId],
    queryFn: () => fetchLiqo(schoolId || undefined),
  });

  const attention = useMemo(() => {
    if (!data) return null;
    const thresholds = data.thresholds;
    return {
      silent: silentGroups(data.groups, thresholds.silentWeeks),
      low: lowAttendanceGroups(data.groups, thresholds.lowAttendance, thresholds.minAttendanceWeeks),
      late: latePembina(data.groups, thresholds.latePembina),
    };
  }, [data]);

  const visibleGroups = useMemo(() => {
    if (!data) return [];
    if (status === 'ALL') return data.groups;
    return data.groups.filter((group) => group.status === status);
  }, [data, status]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'ALL') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const multiSchool = (data?.schools.length ?? 0) > 1;

  return (
    <RoleGuard allowedRoles={['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH']}>
      <PageContainer tight>
        <PageHeader
          title="Liqo pekanan"
          description="Status laporan liqo tiap kelompok, plus yang perlu ditindaklanjuti."
          compact
        />

        {isLoading ? (
          <LoadingSkeleton className="h-64 rounded-2xl" />
        ) : isError || !data || !attention ? (
          <EmptyState title="Gagal memuat liqo" description="Coba muat ulang halaman." />
        ) : (
          <div className="space-y-6">
            {(multiSchool || schoolId) && (
              <select
                aria-label="Pilih PGM"
                className="flex h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                value={data.schools.some((school) => school.id === schoolId) ? schoolId : ''}
                onChange={(event) => setParam('schoolId', event.target.value)}
              >
                <option value="">Semua PGM</option>
                {data.schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            )}
            {data.groups.length === 0 ? (
              <EmptyState
                title="Belum ada kelompok aktif"
                description="Kelompok yang aktif di PGM akan muncul di sini."
              />
            ) : (
          <>

            <WeekSummary title="Pekan lalu" caption="Angka final" week={data.lastWeek} />
            <WeekSummary title="Pekan ini" caption="Masih berjalan sampai Minggu" week={data.thisWeek} />

            <section className="space-y-3">
              <AppSectionHeader title="Perlu perhatian" />
              <p className="px-0.5 text-xs text-muted-foreground">{attentionSummary(data)}</p>
              {attention.silent.length === 0 &&
              attention.low.length === 0 &&
              attention.late.length === 0 &&
              data.absentMembers.length === 0 ? (
                <ListGroup>
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                    Tidak ada kelompok atau anggota yang perlu ditindaklanjuti.
                  </p>
                </ListGroup>
              ) : (
                <div className="space-y-3">
                  {attention.silent.length > 0 && (
                    <AlertList title={`Belum lapor ${data.thresholds.silentWeeks} pekan atau lebih`}>
                      {attention.silent.map((group) => (
                        <AlertRow
                          key={group.id}
                          href={`/kelompok/${group.id}`}
                          title={group.name}
                          subtitle={`${group.pembinaName} · belum lapor ${streakLabel(group.missedStreak, group.missedStreakCapped)}`}
                          phone={group.pembinaPhone}
                        />
                      ))}
                    </AlertList>
                  )}
                  {data.absentMembers.length > 0 && (
                    <AlertList
                      title={`Anggota alpa ${data.thresholds.absentWeeks} pekan berturut`}
                      extra={data.absentTotal > data.absentMembers.length ? `${data.absentTotal} anggota` : undefined}
                    >
                      {data.absentMembers.map((member) => (
                        <AlertRow
                          key={`${member.groupId}-${member.userId}`}
                          href={`/kelompok/${member.groupId}/anggota/${member.userId}`}
                          title={member.name}
                          subtitle={`${member.groupName}${multiSchool ? ` · ${member.schoolName}` : ''} · alpa ${member.weeks} pekan`}
                        />
                      ))}
                    </AlertList>
                  )}
                  {attention.low.length > 0 && (
                    <AlertList title={`Kehadiran di bawah ${data.thresholds.lowAttendance}%`}>
                      {attention.low.map((group) => (
                        <AlertRow
                          key={group.id}
                          href={`/kelompok/${group.id}`}
                          title={group.name}
                          subtitle={`${group.pembinaName} · ${group.recentAttendanceRate}% dari ${group.recentSubmittedWeeks} laporan`}
                          phone={group.pembinaPhone}
                        />
                      ))}
                    </AlertList>
                  )}
                  {attention.late.length > 0 && (
                    <AlertList title="Pembina sering terlambat">
                      {attention.late.map((pembina) => (
                        <AlertRow
                          key={pembina.id}
                          href={`/users/${pembina.id}`}
                          title={pembina.name}
                          subtitle={`Terlambat ${pembina.late} dari ${pembina.submitted} laporan, 4 pekan terakhir`}
                          phone={pembina.phone}
                        />
                      ))}
                    </AlertList>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <AppSectionHeader title="Status kelompok" />
              <div className="flex gap-2 overflow-x-auto pb-1">
                {FILTERS.map((filter) => {
                  const count =
                    filter.id === 'ALL' ? data.groups.length : data.groups.filter((group) => group.status === filter.id).length;
                  const active = status === filter.id;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      aria-pressed={active}
                      className={cn(
                        'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
                        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}
                      onClick={() => setParam('status', filter.id)}
                    >
                      {filter.label} {count}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 px-0.5 text-[11px] text-muted-foreground">
                <LegendDot className="bg-emerald-500" label="Tepat waktu" />
                <LegendDot className="bg-orange-500" label="Terlambat" />
                <LegendDot className="bg-amber-400" label="Draft" />
                <LegendDot className="bg-rose-500" label="Belum" />
                <span>Kanan = pekan ini</span>
              </div>
              {visibleGroups.length === 0 ? (
                <EmptyState title="Tidak ada kelompok" description="Tidak ada kelompok dengan status ini." />
              ) : (
                <ListGroup>
                  {visibleGroups.map((group, index) => {
                    const session = [
                      group.sessionDate ? formatDate(group.sessionDate) : null,
                      group.location,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                      return (
                      <div key={group.id} className={cn('flex items-start gap-3 px-4 py-3.5 md:px-5', index > 0 && 'border-t border-border/60')}>
                        <Link to={groupHref(group)} className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{group.name}</p>
                            <p className="truncate text-sm text-muted-foreground">
                              {[
                                group.pembinaName,
                                getLevelLabel(group.level),
                                getGenderLabel(group.gender),
                                multiSchool ? group.schoolName : null,
                                attendanceLabel(group),
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                            {session && <p className="truncate text-xs text-muted-foreground">{session}</p>}
                            {group.notes && <p className="line-clamp-2 text-xs text-muted-foreground">{group.notes}</p>}
                            <WeekDots weeks={group.weeks} thisWeek={data.weekDate} />
                          </div>
                          <StatusBadge status={group.status} />
                        </Link>
                        {group.pembinaPhone && <WhatsAppButton phone={group.pembinaPhone} size="sm" />}
                      </div>
                    );
                  })}
                </ListGroup>
              )}
            </section>
          </>
            )}
          </div>
        )}
      </PageContainer>
    </RoleGuard>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <i className={cn('h-2 w-2 rounded-full', className)} />
      {label}
    </span>
  );
}

function AlertList({ title, extra, children }: { title: string; extra?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 px-0.5 text-xs font-medium text-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
        {title}
        {extra && <span className="font-normal text-muted-foreground">· {extra}</span>}
      </p>
      <ListGroup>{children}</ListGroup>
    </div>
  );
}

function AlertRow({
  href,
  title,
  subtitle,
  phone,
}: {
  href: string;
  title: string;
  subtitle: string;
  phone?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-border/60 px-4 py-3 first:border-t-0 md:px-5">
      <Link to={href} className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
      </Link>
      {phone && <WhatsAppButton phone={phone} size="sm" />}
    </div>
  );
}
