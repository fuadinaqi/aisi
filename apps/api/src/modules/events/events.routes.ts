import { Router } from 'express';
import { param } from '../../utils/param.js';
import { eventSchema, paginationSchema, POINT_RULES } from '@dakwah/shared';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, checkRole, validate } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', validate(paginationSchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const skip = (page - 1) * limit;
    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where: { isPublished: true },
        skip,
        take: limit,
        orderBy: { startAt: 'asc' },
      }),
      prisma.event.count({ where: { isPublished: true } }),
    ]);
    sendSuccess(res, events, undefined, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

router.post('/', checkAuth, checkRole(Role.ADMIN, Role.SUPERADMIN), validate(eventSchema), async (req, res, next) => {
  try {
    const event = await prisma.event.create({
      data: { ...req.body, createdById: req.user!.userId },
    });
    sendSuccess(res, event, 'Event berhasil dibuat', 201);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: param(req.params.id) } });
    if (!event) throw new AppError(404, 'Event tidak ditemukan');
    sendSuccess(res, event);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', checkAuth, checkRole(Role.ADMIN, Role.SUPERADMIN), async (req, res, next) => {
  try {
    const event = await prisma.event.update({ where: { id: param(req.params.id) }, data: req.body });
    sendSuccess(res, event, 'Event berhasil diperbarui');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', checkAuth, checkRole(Role.ADMIN, Role.SUPERADMIN), async (req, res, next) => {
  try {
    await prisma.event.delete({ where: { id: param(req.params.id) } });
    sendSuccess(res, null, 'Event berhasil dihapus');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/attend', checkAuth, async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: param(req.params.id) } });
    if (!event || !event.isPublished) throw new AppError(404, 'Event tidak ditemukan');

    const existing = await prisma.eventAttendance.findUnique({
      where: { eventId_userId: { eventId: param(req.params.id), userId: req.user!.userId } },
    });
    if (existing) throw new AppError(400, 'Anda sudah check-in event ini');

    const roles = req.user!.roles;
    const isPembina = roles.includes('PEMBINA');
    const points = isPembina ? POINT_RULES.PEMBINA_ATTEND_EVENT : POINT_RULES.ANGGOTA_ATTEND_EVENT;

    await prisma.$transaction(async (tx) => {
      await tx.eventAttendance.create({
        data: { eventId: param(req.params.id), userId: req.user!.userId },
      });
      if (event.pointValue > 0 || points > 0) {
        const pts = event.pointValue || points;
        await tx.pointLog.create({
          data: {
            userId: req.user!.userId,
            points: pts,
            description: `Hadir event: ${event.title}`,
            refType: 'EVENT',
            refId: event.id,
          },
        });
        await tx.user.update({
          where: { id: req.user!.userId },
          data: { totalPoints: { increment: pts } },
        });
      }
    });

    sendSuccess(res, null, 'Check-in berhasil');
  } catch (err) {
    next(err);
  }
});

export default router;
