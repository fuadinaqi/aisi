import { Router } from 'express';
import { param } from '../../utils/param.js';
import { evaluationSchema, paginationSchema, POINT_RULES } from '@dakwah/shared';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, validate, isPembinaOfGroup } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { getMonday, isSubmitOnTime } from '../../utils/weekDate.js';
import { upload, getPublicUrl } from '../../lib/storage.js';
import { AttendanceStatus } from '@prisma/client';

const router = Router();

router.use(checkAuth);

router.get('/', validate(paginationSchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const { groupId, weekDate } = req.query as { groupId?: string; weekDate?: string };
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (groupId) where.groupId = groupId;
    if (weekDate) where.weekDate = getMonday(new Date(weekDate));

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

    const normalizedWeek = getMonday(new Date(weekDate));

    const evaluation = await prisma.weeklyEvaluation.upsert({
      where: { groupId_weekDate: { groupId, weekDate: normalizedWeek } },
      update: {
        notes,
        attendances: {
          deleteMany: {},
          create: attendances.map((a: { userId: string; status: AttendanceStatus; note?: string }) => ({
            userId: a.userId,
            status: a.status,
            note: a.note,
          })),
        },
      },
      create: {
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

    await prisma.$transaction(async (tx) => {
      await tx.weeklyEvaluation.update({
        where: { id: evaluation.id },
        data: { isSubmitted: true, submittedAt },
      });

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

      for (const att of evaluation.attendances) {
        if (att.status === AttendanceStatus.HADIR) {
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
