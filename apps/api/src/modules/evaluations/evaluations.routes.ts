import { Router } from 'express';
import { param } from '../../utils/param.js';
import {
  evaluationSchema,
  evaluationListQuerySchema,
  POINT_RULES,
  isPointEligible,
} from '@dakwah/shared';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, validate, isPembinaOfGroup, getUserSchoolIds, canAccessSchool } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { getMonday, isSubmitOnTime, assertWeekDateNotFuture } from '../../utils/weekDate.js';
import { upload, getPublicUrl } from '../../lib/storage.js';
import { AttendanceStatus } from '@prisma/client';

const router = Router();

router.use(checkAuth);

async function buildEvaluationWhere(
  userId: string,
  roles: string[],
  filters: { groupId?: string; weekDate?: Date; schoolId?: string },
) {
  const where: Record<string, unknown> = {};
  if (filters.groupId) where.groupId = filters.groupId;
  if (filters.weekDate) where.weekDate = filters.weekDate;

  const isAdmin = roles.includes('SUPERADMIN') || roles.includes('ADMIN');
  const groupFilter: Record<string, unknown> = {};

  if (!isAdmin && roles.includes('PEMBINA')) {
    if (filters.groupId) {
      const isOwner = await isPembinaOfGroup(userId, filters.groupId);
      if (!isOwner) throw new AppError(403, 'Akses ditolak');
    }
    groupFilter.pembinaId = userId;
  } else if (!isAdmin && roles.includes('PJ_SEKOLAH')) {
    const schoolIds = await getUserSchoolIds(userId);
    if (filters.schoolId) {
      if (!schoolIds.includes(filters.schoolId)) throw new AppError(403, 'Akses ditolak');
      groupFilter.schoolId = filters.schoolId;
    } else {
      groupFilter.schoolId = { in: schoolIds };
    }
    if (filters.groupId) {
      const group = await prisma.group.findFirst({
        where: { id: filters.groupId, schoolId: { in: schoolIds } },
        select: { id: true },
      });
      if (!group) throw new AppError(403, 'Akses ditolak');
    }
  } else if (filters.schoolId) {
    groupFilter.schoolId = filters.schoolId;
  }

  if (Object.keys(groupFilter).length > 0) {
    where.group = groupFilter;
  }

  return where;
}

async function assertCanAccessEvaluation(
  userId: string,
  roles: string[],
  groupId: string,
) {
  const isAdmin = roles.includes('SUPERADMIN') || roles.includes('ADMIN');
  if (isAdmin) return;

  if (roles.includes('PEMBINA')) {
    const isOwner = await isPembinaOfGroup(userId, groupId);
    if (!isOwner) throw new AppError(403, 'Akses ditolak');
    return;
  }

  if (roles.includes('PJ_SEKOLAH')) {
    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { schoolId: true } });
    if (!group) throw new AppError(404, 'Kelompok tidak ditemukan');
    const allowed = await canAccessSchool(userId, roles, group.schoolId);
    if (!allowed) throw new AppError(403, 'Akses ditolak');
  }
}

router.get('/', validate(evaluationListQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const { groupId, weekDate, schoolId } = req.query as {
      groupId?: string;
      weekDate?: string;
      schoolId?: string;
    };
    const skip = (page - 1) * limit;

    const where = await buildEvaluationWhere(req.user!.userId, req.user!.roles, {
      groupId,
      weekDate: weekDate ? getMonday(new Date(weekDate)) : undefined,
      schoolId,
    });

    const [evaluations, total] = await Promise.all([
      prisma.weeklyEvaluation.findMany({
        where,
        include: {
          group: { select: { id: true, name: true } },
          attendances: { include: { user: { select: { id: true, name: true } } } },
        },
        skip,
        take: limit,
        orderBy: { weekDate: 'desc' },
      }),
      prisma.weeklyEvaluation.count({ where }),
    ]);

    sendSuccess(res, evaluations, undefined, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(evaluationSchema), async (req, res, next) => {
  try {
    const { groupId, weekDate, notes, attendances } = req.body;
    const isOwner = await isPembinaOfGroup(req.user!.userId, groupId);
    if (!isOwner) throw new AppError(403, 'Hanya pembina kelompok yang bisa membuat evaluasi');

    try {
      assertWeekDateNotFuture(weekDate);
    } catch {
      throw new AppError(400, 'Tanggal evaluasi tidak boleh setelah hari ini');
    }

    const normalizedWeek = getMonday(new Date(weekDate));

    const existing = await prisma.weeklyEvaluation.findUnique({
      where: { groupId_weekDate: { groupId, weekDate: normalizedWeek } },
    });
    if (existing) {
      throw new AppError(
        409,
        existing.isSubmitted
          ? 'Evaluasi pekan ini sudah dikirim'
          : 'Evaluasi untuk pekan ini sudah ada. Silakan edit evaluasi yang ada.',
      );
    }

    const evaluation = await prisma.weeklyEvaluation.create({
      data: {
        groupId,
        createdById: req.user!.userId,
        weekDate: normalizedWeek,
        notes,
        attendances: {
          create: attendances.map((a: { userId: string; status: AttendanceStatus; note?: string }) => ({
            userId: a.userId,
            status: a.status,
            note: a.note,
          })),
        },
      },
      include: { attendances: { include: { user: { select: { id: true, name: true } } } } },
    });

    sendSuccess(res, evaluation, 'Evaluasi berhasil disimpan', 201);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const evaluation = await prisma.weeklyEvaluation.findUnique({
      where: { id: param(req.params.id) },
      include: {
        group: true,
        attendances: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
    if (!evaluation) throw new AppError(404, 'Evaluasi tidak ditemukan');

    await assertCanAccessEvaluation(req.user!.userId, req.user!.roles, evaluation.groupId);

    sendSuccess(res, evaluation);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const evaluation = await prisma.weeklyEvaluation.findUnique({ where: { id: param(req.params.id) } });
    if (!evaluation) throw new AppError(404, 'Evaluasi tidak ditemukan');
    if (evaluation.isSubmitted) throw new AppError(400, 'Evaluasi sudah disubmit, tidak bisa diubah');

    const isOwner = await isPembinaOfGroup(req.user!.userId, evaluation.groupId);
    if (!isOwner) throw new AppError(403, 'Akses ditolak');

    const { notes, attendances } = req.body;
    const updated = await prisma.weeklyEvaluation.update({
      where: { id: param(req.params.id) },
      data: {
        ...(notes !== undefined && { notes }),
        ...(attendances && {
          attendances: {
            deleteMany: {},
            create: attendances.map((a: { userId: string; status: AttendanceStatus; note?: string }) => ({
              userId: a.userId,
              status: a.status,
              note: a.note,
            })),
          },
        }),
      },
      include: { attendances: { include: { user: { select: { id: true, name: true } } } } },
    });
    sendSuccess(res, updated, 'Evaluasi berhasil diperbarui');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/submit', async (req, res, next) => {
  try {
    const evaluation = await prisma.weeklyEvaluation.findUnique({
      where: { id: param(req.params.id) },
      include: { attendances: true, group: true },
    });
    if (!evaluation) throw new AppError(404, 'Evaluasi tidak ditemukan');
    if (evaluation.isSubmitted) throw new AppError(400, 'Evaluasi sudah disubmit');

    const isOwner = await isPembinaOfGroup(req.user!.userId, evaluation.groupId);
    if (!isOwner) throw new AppError(403, 'Akses ditolak');

    const submittedAt = new Date();
    const onTime = isSubmitOnTime(evaluation.weekDate, submittedAt);
    const pembinaPoints = onTime
      ? POINT_RULES.PEMBINA_SUBMIT_EVALUATION
      : POINT_RULES.PEMBINA_SUBMIT_EVALUATION_LATE;

    const hadirUserIds = evaluation.attendances
      .filter((a) => a.status === AttendanceStatus.HADIR)
      .map((a) => a.userId);
    const pointUsers = await prisma.user.findMany({
      where: { id: { in: [evaluation.createdById, ...hadirUserIds] } },
      select: { id: true, roles: { select: { role: true } } },
    });
    const eligibleIds = new Set(
      pointUsers
        .filter((u) => isPointEligible(u.roles.map((r) => r.role)))
        .map((u) => u.id),
    );

    await prisma.$transaction(async (tx) => {
      await tx.weeklyEvaluation.update({
        where: { id: evaluation.id },
        data: { isSubmitted: true, submittedAt },
      });

      if (eligibleIds.has(evaluation.createdById)) {
        await tx.pointLog.create({
          data: {
            userId: evaluation.createdById,
            points: pembinaPoints,
            description: onTime ? 'Submit evaluasi tepat waktu' : 'Submit evaluasi terlambat',
            refType: 'EVALUATION',
            refId: evaluation.id,
          },
        });
        await tx.user.update({
          where: { id: evaluation.createdById },
          data: { totalPoints: { increment: pembinaPoints } },
        });
      }

      for (const att of evaluation.attendances) {
        if (att.status === AttendanceStatus.HADIR && eligibleIds.has(att.userId)) {
          await tx.pointLog.create({
            data: {
              userId: att.userId,
              points: POINT_RULES.ANGGOTA_HADIR_PEMBINAAN,
              description: 'Hadir pembinaan mingguan',
              refType: 'EVALUATION',
              refId: evaluation.id,
            },
          });
          await tx.user.update({
            where: { id: att.userId },
            data: { totalPoints: { increment: POINT_RULES.ANGGOTA_HADIR_PEMBINAAN } },
          });
        }
      }
    });

    const updated = await prisma.weeklyEvaluation.findUnique({
      where: { id: param(req.params.id) },
      include: { attendances: true },
    });
    sendSuccess(res, updated, 'Evaluasi berhasil disubmit');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/photos', upload.array('photos', 5), async (req, res, next) => {
  try {
    const evaluation = await prisma.weeklyEvaluation.findUnique({ where: { id: param(req.params.id) } });
    if (!evaluation) throw new AppError(404, 'Evaluasi tidak ditemukan');
    if (evaluation.isSubmitted) throw new AppError(400, 'Evaluasi sudah disubmit');

    const isOwner = await isPembinaOfGroup(req.user!.userId, evaluation.groupId);
    if (!isOwner) throw new AppError(403, 'Akses ditolak');

    const files = req.files as Express.Multer.File[];
    const urls = files.map((f) => getPublicUrl(f.filename));

    const updated = await prisma.weeklyEvaluation.update({
      where: { id: param(req.params.id) },
      data: { photoUrls: { push: urls } },
    });
    sendSuccess(res, updated, 'Foto berhasil diupload');
  } catch (err) {
    next(err);
  }
});

export default router;
