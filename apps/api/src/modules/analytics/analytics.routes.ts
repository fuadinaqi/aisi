import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { param } from '../../utils/param.js';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, checkRole, canAccessSchool, isPembinaOfGroup, getUserSchoolIds } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { Role } from '@prisma/client';
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

async function buildOverview(schoolIds?: string[]) {
  const thisMonday = getMonday(new Date());
  const eightWeeksAgo = new Date(thisMonday);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const groupWhere = schoolIds?.length
    ? { isActive: true, schoolId: { in: schoolIds } }
    : { isActive: true };

  if (schoolIds?.length) {
    const [totalGroups, pembinaRows, totalAnggota, evaluationsThisWeek, attendanceTrend] = await Promise.all([
      prisma.group.count({ where: groupWhere }),
      prisma.group.findMany({ where: groupWhere, select: { pembinaId: true }, distinct: ['pembinaId'] }),
      prisma.groupMember.count({ where: { isActive: true, group: groupWhere } }),
      prisma.weeklyEvaluation.count({
        where: { weekDate: thisMonday, isSubmitted: true, group: groupWhere },
      }),
      getAttendanceTrend(eightWeeksAgo, schoolIds),
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
      topSchools: [],
    };
  }

  const [totalSchools, totalGroups, totalPembina, totalAnggota, evaluationsThisWeek, totalGroupsActive, attendanceTrend, topSchools] =
    await Promise.all([
      prisma.school.count({ where: { isActive: true } }),
      prisma.group.count({ where: { isActive: true } }),
      prisma.userRole.count({ where: { role: Role.PEMBINA } }),
      prisma.userRole.count({ where: { role: Role.ANGGOTA } }),
      prisma.weeklyEvaluation.count({ where: { weekDate: thisMonday, isSubmitted: true } }),
      prisma.group.count({ where: { isActive: true } }),
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
