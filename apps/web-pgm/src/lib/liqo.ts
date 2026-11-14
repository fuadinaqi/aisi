import { api, type ApiResponse } from '@/lib/api';

export type LiqoStatus = 'ON_TIME' | 'LATE' | 'DRAFT' | 'MISSING';

export interface LiqoWeek {
  weekDate: string;
  totalGroups: number;
  submitted: number;
  onTime: number;
  late: number;
  draft: number;
  missing: number;
  submissionRate: number;
  hadir: number;
  izin: number;
  sakit: number;
  tidakHadir: number;
  attendanceRate: number | null;
}

export interface LiqoGroup {
  id: string;
  name: string;
  level: string;
  gender: string;
  schoolId: string;
  schoolName: string;
  pembinaId: string;
  pembinaName: string;
  pembinaPhone?: string | null;
  memberCount: number;
  status: LiqoStatus;
  evaluationId?: string | null;
  hadir: number;
  izin: number;
  sakit: number;
  tidakHadir: number;
  attendanceRate: number | null;
  location?: string | null;
  sessionDate?: string | null;
  notes?: string | null;
  missedStreak: number;
  missedStreakCapped: boolean;
  recentAttendanceRate: number | null;
  recentSubmittedWeeks: number;
  lateCount: number;
  lateWindowSubmitted: number;
  weeks: string[];
}

export interface LiqoAbsentMember {
  userId: string;
  name: string;
  groupId: string;
  groupName: string;
  schoolName: string;
  weeks: number;
}

export interface LiqoThresholds {
  silentWeeks: number;
  lowAttendance: number;
  minAttendanceWeeks: number;
  absentWeeks: number;
  latePembina: number;
}

export interface LiqoBoard {
  weekDate: string;
  previousWeekDate: string;
  thisWeek: LiqoWeek;
  lastWeek: LiqoWeek;
  schools: { id: string; name: string }[];
  groups: LiqoGroup[];
  absentMembers: LiqoAbsentMember[];
  absentTotal: number;
  thresholds: LiqoThresholds;
}

export interface LatePembina {
  id: string;
  name: string;
  phone?: string | null;
  late: number;
  submitted: number;
}

export const LIQO_STATUS_LABEL: Record<LiqoStatus, string> = {
  ON_TIME: 'Tepat waktu',
  LATE: 'Terlambat',
  DRAFT: 'Draft',
  MISSING: 'Belum lapor',
};

export function fetchLiqo(schoolId?: string) {
  return api
    .get<ApiResponse<LiqoBoard>>('/analytics/liqo', { params: schoolId ? { schoolId } : {} })
    .then((res) => res.data.data);
}

export function silentGroups(groups: LiqoGroup[], minWeeks: number) {
  return groups
    .filter((group) => group.missedStreak >= minWeeks)
    .sort((a, b) => b.missedStreak - a.missedStreak || a.name.localeCompare(b.name, 'id'));
}

export function lowAttendanceGroups(groups: LiqoGroup[], maxRate: number, minWeeks: number) {
  return groups
    .filter(
      (group) =>
        group.recentSubmittedWeeks >= minWeeks &&
        group.recentAttendanceRate != null &&
        group.recentAttendanceRate < maxRate,
    )
    .sort(
      (a, b) =>
        (a.recentAttendanceRate ?? 0) - (b.recentAttendanceRate ?? 0) || a.name.localeCompare(b.name, 'id'),
    );
}

export function latePembina(groups: LiqoGroup[], minLate: number): LatePembina[] {
  const map = new Map<string, LatePembina>();
  for (const group of groups) {
    const current = map.get(group.pembinaId) ?? {
      id: group.pembinaId,
      name: group.pembinaName,
      phone: group.pembinaPhone,
      late: 0,
      submitted: 0,
    };
    current.late += group.lateCount;
    current.submitted += group.lateWindowSubmitted;
    if (!current.phone && group.pembinaPhone) current.phone = group.pembinaPhone;
    map.set(group.pembinaId, current);
  }
  return [...map.values()]
    .filter((pembina) => pembina.late >= minLate)
    .sort((a, b) => b.late - a.late || a.name.localeCompare(b.name, 'id'));
}

export function attentionSummary(board: LiqoBoard) {
  const thresholds = board.thresholds;
  const parts: string[] = [];
  const silent = silentGroups(board.groups, thresholds.silentWeeks).length;
  const low = lowAttendanceGroups(board.groups, thresholds.lowAttendance, thresholds.minAttendanceWeeks).length;
  const late = latePembina(board.groups, thresholds.latePembina).length;
  if (silent) parts.push(`${silent} kelompok belum lapor`);
  if (board.absentTotal) parts.push(`${board.absentTotal} anggota alpa berturut`);
  if (low) parts.push(`${low} kehadiran rendah`);
  if (late) parts.push(`${late} pembina sering terlambat`);
  return parts.length ? parts.join(' · ') : 'Tidak ada yang perlu ditindaklanjuti';
}

export function groupHref(group: LiqoGroup) {
  return group.evaluationId ? `/evaluasi/${group.evaluationId}` : `/kelompok/${group.id}`;
}

export function streakLabel(weeks: number, capped = false) {
  return capped ? `${weeks}+ pekan` : `${weeks} pekan`;
}
