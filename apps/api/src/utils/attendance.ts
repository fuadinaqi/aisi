import { AttendanceStatus } from '@prisma/client';
import { getMonday } from './weekDate.js';

type EvaluationWithAttendances = {
  weekDate: Date;
  attendances: { userId: string; status: AttendanceStatus }[];
};

type MemberInput = {
  userId: string;
  joinedAt: Date;
};

export type AttendanceStats = {
  totalPekan: number;
  totalHadir: number;
  attendanceRate: number | null;
  totalSlots?: number;
};

export function computeMemberAttendance(
  member: MemberInput,
  evaluations: EvaluationWithAttendances[],
): AttendanceStats {
  const joinedMonday = getMonday(member.joinedAt);
  const relevant = evaluations.filter((e) => e.weekDate >= joinedMonday);
  const totalPekan = relevant.length;
  const totalHadir = relevant.filter((e) =>
    e.attendances.some((a) => a.userId === member.userId && a.status === AttendanceStatus.HADIR),
  ).length;

  return {
    totalPekan,
    totalHadir,
    attendanceRate: totalPekan > 0 ? Math.round((totalHadir / totalPekan) * 100) : null,
  };
}

/** Kehadiran agregat kelompok sejak kelompok dibuat */
export function computeGroupAttendance(
  groupCreatedAt: Date,
  members: MemberInput[],
  evaluations: EvaluationWithAttendances[],
): AttendanceStats {
  const groupMonday = getMonday(groupCreatedAt);
  const relevant = evaluations.filter((e) => e.weekDate >= groupMonday);
  const totalPekan = relevant.length;

  let totalHadir = 0;
  let totalSlots = 0;

  for (const evaluation of relevant) {
    const eligible = members.filter((m) => getMonday(m.joinedAt) <= evaluation.weekDate);
    totalSlots += eligible.length;
    totalHadir += evaluation.attendances.filter(
      (a) =>
        a.status === AttendanceStatus.HADIR && eligible.some((m) => m.userId === a.userId),
    ).length;
  }

  return {
    totalPekan,
    totalHadir,
    totalSlots,
    attendanceRate: totalSlots > 0 ? Math.round((totalHadir / totalSlots) * 100) : null,
  };
}

export function attachGroupAttendance<T extends { id: string; createdAt: Date }>(
  groups: T[],
  members: { groupId: string; userId: string; joinedAt: Date }[],
  evaluations: { groupId: string; weekDate: Date; attendances: { userId: string; status: AttendanceStatus }[] }[],
): (T & AttendanceStats)[] {
  return groups.map((group) => {
    const groupMembers = members
      .filter((m) => m.groupId === group.id)
      .map((m) => ({ userId: m.userId, joinedAt: m.joinedAt }));
    const groupEvals = evaluations
      .filter((e) => e.groupId === group.id)
      .map((e) => ({ weekDate: e.weekDate, attendances: e.attendances }));

    return { ...group, ...computeGroupAttendance(group.createdAt, groupMembers, groupEvals) };
  });
}
