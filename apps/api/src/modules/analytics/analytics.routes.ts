import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { param } from '../../utils/param.js';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, checkRole, canAccessSchool, isPembinaOfGroup, getUserSchoolIds } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { Role, Gender, GroupLevel } from '@prisma/client';
import { getMonday } from '../../utils/weekDate.js';

const router = Router();

router.use(checkAuth);

async function getAttendanceTrend(eightWeeksAgo: Date, schoolIds?: string[]) {
  if (schoolIds?.length) {
    return prisma.$queryRaw<{ week: Date; rate: number }[]>`
      SELECT we."weekDate" as week,
        ROUND(COUNT(CASE WHEN ea.status = 'HADIR' THEN 1 END)::numeric /
          NULLIF(COUNT(ea.id), 0) * 100, 1) as rate
      FROM "WeeklyEvaluation" we
      INNER JOIN "Group" g ON g.id = we."groupId"
      LEFT JOIN "EvaluationAttendance" ea ON ea."evaluationId" = we.id
      WHERE we."isSubmitted" = true
        AND we."weekDate" >= ${eightWeeksAgo}
        AND g."schoolId" IN (${Prisma.join(schoolIds)})
      GROUP BY we."weekDate"
      ORDER BY we."weekDate" ASC
      LIMIT 8
    `.catch(() => []);
  }

  return prisma.$queryRaw<{ week: Date; rate: number }[]>`
    SELECT we."weekDate" as week,
      ROUND(COUNT(CASE WHEN ea.status = 'HADIR' THEN 1 END)::numeric /
        NULLIF(COUNT(ea.id), 0) * 100, 1) as rate
    FROM "WeeklyEvaluation" we
    LEFT JOIN "EvaluationAttendance" ea ON ea."evaluationId" = we.id
    WHERE we."isSubmitted" = true AND we."weekDate" >= ${eightWeeksAgo}
    GROUP BY we."weekDate"
    ORDER BY we."weekDate" ASC
    LIMIT 8
  `.catch(() => []);
}

async function getGenderBreakdown(groupWhere: { isActive: boolean; schoolId?: { in: string[] } }) {
  const [groupsIkhwan, groupsAkhwat, anggotaIkhwan, anggotaAkhwat, pembinaRows] = await Promise.all([
    prisma.group.count({ where: { ...groupWhere, gender: Gender.IKHWAN } }),
    prisma.group.count({ where: { ...groupWhere, gender: Gender.AKHWAT } }),
    prisma.groupMember.count({
      where: { isActive: true, group: groupWhere, user: { gender: Gender.IKHWAN } },
    }),
    prisma.groupMember.count({
      where: { isActive: true, group: groupWhere, user: { gender: Gender.AKHWAT } },
    }),
    prisma.group.findMany({
      where: groupWhere,
      select: { pembina: { select: { gender: true } } },
      distinct: ['pembinaId'],
    }),
  ]);

  let pembinaIkhwan = 0;
  let pembinaAkhwat = 0;
  for (const row of pembinaRows) {
    if (row.pembina.gender === Gender.AKHWAT) pembinaAkhwat += 1;
    else pembinaIkhwan += 1;
  }

  return {
    groups: { ikhwan: groupsIkhwan, akhwat: groupsAkhwat },
    pembina: { ikhwan: pembinaIkhwan, akhwat: pembinaAkhwat },
    anggota: { ikhwan: anggotaIkhwan, akhwat: anggotaAkhwat },
  };
}

async function getLevelBreakdown(groupWhere: { isActive: boolean; schoolId?: { in: string[] } }) {
  const [groupsLevel1, groupsLevel2, anggotaLevel1, anggotaLevel2, pembinaLevel1, pembinaLevel2] =
    await Promise.all([
      prisma.group.count({ where: { ...groupWhere, level: GroupLevel.LEVEL_1 } }),
      prisma.group.count({ where: { ...groupWhere, level: GroupLevel.LEVEL_2 } }),
      prisma.groupMember.count({
        where: { isActive: true, group: { ...groupWhere, level: GroupLevel.LEVEL_1 } },
      }),
      prisma.groupMember.count({
        where: { isActive: true, group: { ...groupWhere, level: GroupLevel.LEVEL_2 } },
      }),
      prisma.group.findMany({
        where: { ...groupWhere, level: GroupLevel.LEVEL_1 },
        select: { pembinaId: true },
        distinct: ['pembinaId'],
      }),
      prisma.group.findMany({
        where: { ...groupWhere, level: GroupLevel.LEVEL_2 },
        select: { pembinaId: true },
        distinct: ['pembinaId'],
      }),
    ]);

  return {
    groups: { level1: groupsLevel1, level2: groupsLevel2 },
    pembina: { level1: pembinaLevel1.length, level2: pembinaLevel2.length },
    anggota: { level1: anggotaLevel1, level2: anggotaLevel2 },
  };
}

type GroupWhere = { isActive: boolean; schoolId?: { in: string[] } };

function levelGenderWhere(groupWhere: GroupWhere, level: GroupLevel, gender: Gender) {
  return { ...groupWhere, level, gender };
}

async function getLevelGenderBreakdown(groupWhere: GroupWhere) {
  const countGroups = (level: GroupLevel, gender: Gender) =>
    prisma.group.count({ where: levelGenderWhere(groupWhere, level, gender) });

  const countAnggota = (level: GroupLevel, gender: Gender) =>
    prisma.groupMember.count({
      where: {
        isActive: true,
        group: levelGenderWhere(groupWhere, level, gender),
        user: { gender },
      },
    });

  const countPembina = async (level: GroupLevel, gender: Gender) => {
    const rows = await prisma.group.findMany({
      where: levelGenderWhere(groupWhere, level, gender),
      select: { pembinaId: true },
      distinct: ['pembinaId'],
    });
    return rows.length;
  };

  const [
    groupsL1I, groupsL1A, groupsL2I, groupsL2A,
    pembinaL1I, pembinaL1A, pembinaL2I, pembinaL2A,
    anggotaL1I, anggotaL1A, anggotaL2I, anggotaL2A,
  ] = await Promise.all([
    countGroups(GroupLevel.LEVEL_1, Gender.IKHWAN),
    countGroups(GroupLevel.LEVEL_1, Gender.AKHWAT),
    countGroups(GroupLevel.LEVEL_2, Gender.IKHWAN),
    countGroups(GroupLevel.LEVEL_2, Gender.AKHWAT),
    countPembina(GroupLevel.LEVEL_1, Gender.IKHWAN),
    countPembina(GroupLevel.LEVEL_1, Gender.AKHWAT),
    countPembina(GroupLevel.LEVEL_2, Gender.IKHWAN),
    countPembina(GroupLevel.LEVEL_2, Gender.AKHWAT),
    countAnggota(GroupLevel.LEVEL_1, Gender.IKHWAN),
    countAnggota(GroupLevel.LEVEL_1, Gender.AKHWAT),
    countAnggota(GroupLevel.LEVEL_2, Gender.IKHWAN),
    countAnggota(GroupLevel.LEVEL_2, Gender.AKHWAT),
  ]);

  const cell = (ikhwan: number, akhwat: number) => ({ ikhwan, akhwat });

  return {
    groups: { level1: cell(groupsL1I, groupsL1A), level2: cell(groupsL2I, groupsL2A) },
    pembina: { level1: cell(pembinaL1I, pembinaL1A), level2: cell(pembinaL2I, pembinaL2A) },
    anggota: { level1: cell(anggotaL1I, anggotaL1A), level2: cell(anggotaL2I, anggotaL2A) },
  };
}

async function buildOverview(schoolIds?: string[]) {
  const thisMonday = getMonday(new Date());
  const eightWeeksAgo = new Date(thisMonday);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const groupWhere = schoolIds?.length
    ? { isActive: true, schoolId: { in: schoolIds } }
    : { isActive: true };

  if (schoolIds?.length) {
    const [totalGroups, pembinaRows, totalAnggota, evaluationsThisWeek, attendanceTrend, genderBreakdown, levelBreakdown, levelGenderBreakdown] =
      await Promise.all([
      prisma.group.count({ where: groupWhere }),
      prisma.group.findMany({ where: groupWhere, select: { pembinaId: true }, distinct: ['pembinaId'] }),
      prisma.groupMember.count({ where: { isActive: true, group: groupWhere } }),
      prisma.weeklyEvaluation.count({
        where: { weekDate: thisMonday, isSubmitted: true, group: groupWhere },
      }),
      getAttendanceTrend(eightWeeksAgo, schoolIds),
      getGenderBreakdown(groupWhere),
      getLevelBreakdown(groupWhere),
      getLevelGenderBreakdown(groupWhere),
    ]);

    const totalPembina = pembinaRows.length;

    return {
      scope: 'school' as const,
      totalSchools: schoolIds.length,
      totalGroups,
      totalPembina,
      totalAnggota,
      submissionRate: totalGroups > 0 ? Math.round((evaluationsThisWeek / totalGroups) * 100) : 0,
      evaluationsThisWeek,
      attendanceTrend,
      genderBreakdown,
      levelBreakdown,
      levelGenderBreakdown,
      topSchools: [],
    };
  }

  const groupWhereAll = { isActive: true as const };

  const [totalSchools, totalGroups, totalPembina, totalAnggota, evaluationsThisWeek, totalGroupsActive, attendanceTrend, topSchools, genderBreakdown, levelBreakdown, levelGenderBreakdown] =
    await Promise.all([
      prisma.school.count({ where: { isActive: true } }),
      prisma.group.count({ where: groupWhereAll }),
      prisma.userRole.count({ where: { role: Role.PEMBINA } }),
      prisma.userRole.count({ where: { role: Role.ANGGOTA } }),
      prisma.weeklyEvaluation.count({ where: { weekDate: thisMonday, isSubmitted: true } }),
      prisma.group.count({ where: groupWhereAll }),
      getAttendanceTrend(eightWeeksAgo),
      prisma.school.findMany({
        where: { isActive: true },
        take: 5,
        select: {
          id: true,
          name: true,
          groups: {
            where: { isActive: true },
            select: {
              evaluations: {
                where: { isSubmitted: true, weekDate: thisMonday },
                select: { attendances: { select: { status: true } } },
              },
            },
          },
        },
      }),
      getGenderBreakdown(groupWhereAll),
      getLevelBreakdown(groupWhereAll),
      getLevelGenderBreakdown(groupWhereAll),
    ]);

  return {
    scope: 'city' as const,
    totalSchools,
    totalGroups,
    totalPembina,
    totalAnggota,
    submissionRate: totalGroupsActive > 0 ? Math.round((evaluationsThisWeek / totalGroupsActive) * 100) : 0,
    evaluationsThisWeek,
    attendanceTrend,
    genderBreakdown,
    levelBreakdown,
    levelGenderBreakdown,
    topSchools: topSchools.map((s) => ({
      id: s.id,
      name: s.name,
      groupCount: s.groups.length,
    })),
  };
}

router.get('/overview', checkRole(Role.SUPERADMIN, Role.ADMIN, Role.PJ_SEKOLAH), async (req, res, next) => {
  try {
    const roles = req.user!.roles;
    const isAdmin = roles.includes('SUPERADMIN') || roles.includes('ADMIN');

    if (isAdmin) {
      sendSuccess(res, await buildOverview());
      return;
    }

    const schoolIds = await getUserSchoolIds(req.user!.userId);
    sendSuccess(res, await buildOverview(schoolIds));
  } catch (err) {
    next(err);
  }
});

router.get('/school/:id', async (req, res, next) => {
  try {
    const canAccess = await canAccessSchool(req.user!.userId, req.user!.roles, param(req.params.id));
    if (!canAccess) throw new AppError(403, 'Akses ditolak');

    const thisMonday = getMonday(new Date());
    const eightWeeksAgo = new Date(thisMonday);
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    const groups = await prisma.group.findMany({
      where: { schoolId: param(req.params.id), isActive: true },
      include: {
        pembina: { select: { id: true, name: true } },
        _count: { select: { members: true } },
        evaluations: {
          where: { weekDate: thisMonday, isSubmitted: true },
          take: 1,
        },
      },
    });

    const totalAnggota = await prisma.groupMember.count({
      where: { group: { schoolId: param(req.params.id), isActive: true }, isActive: true },
    });

    sendSuccess(res, {
      totalGroups: groups.length,
      totalPembina: groups.length,
      totalAnggota,
      submissionRate: groups.length > 0
        ? Math.round((groups.filter((g) => g.evaluations.length > 0).length / groups.length) * 100)
        : 0,
      pembinaList: groups.map((g) => ({
        id: g.pembina.id,
        name: g.pembina.name,
        groupName: g.name,
        memberCount: g._count.members,
        submittedThisWeek: g.evaluations.length > 0,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/group/:id', async (req, res, next) => {
  try {
    const group = await prisma.group.findUnique({ where: { id: param(req.params.id) } });
    if (!group) throw new AppError(404, 'Kelompok tidak ditemukan');

    const roles = req.user!.roles;
    const isOwner = await isPembinaOfGroup(req.user!.userId, param(req.params.id));
    const canSchool = await canAccessSchool(req.user!.userId, roles, group.schoolId);
    if (!roles.includes('SUPERADMIN') && !roles.includes('ADMIN') && !isOwner && !canSchool) {
      throw new AppError(403, 'Akses ditolak');
    }

    const thisMonday = getMonday(new Date());
    const eightWeeksAgo = new Date(thisMonday);
    eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

    const members = await prisma.groupMember.findMany({
      where: { groupId: param(req.params.id), isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            totalPoints: true,
            attendances: {
              where: { evaluation: { groupId: param(req.params.id), isSubmitted: true, weekDate: { gte: eightWeeksAgo } } },
              select: { status: true },
            },
          },
        },
      },
    });

    const submittedThisWeek = await prisma.weeklyEvaluation.findFirst({
      where: { groupId: param(req.params.id), weekDate: thisMonday, isSubmitted: true },
    });

    sendSuccess(res, {
      totalMembers: members.length,
      submittedThisWeek: !!submittedThisWeek,
      members: members.map((m) => {
        const total = m.user.attendances.length;
        const hadir = m.user.attendances.filter((a) => a.status === 'HADIR').length;
        return {
          id: m.user.id,
          name: m.user.name,
          totalPoints: m.user.totalPoints,
          attendanceRate: total > 0 ? Math.round((hadir / total) * 100) : 0,
          totalHadir: hadir,
          totalAbsen: total - hadir,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
