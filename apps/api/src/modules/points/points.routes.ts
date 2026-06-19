import { Router } from 'express';
import { manualPointSchema, paginationSchema } from '@dakwah/shared';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, checkRole, validate } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(checkAuth);

router.get('/me', validate(paginationSchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.pointLog.findMany({
        where: { userId: req.user!.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.pointLog.count({ where: { userId: req.user!.userId } }),
    ]);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { totalPoints: true },
    });

    sendSuccess(res, { totalPoints: user?.totalPoints ?? 0, logs }, undefined, 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/leaderboard', validate(paginationSchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true, totalPoints: true, roles: { select: { role: true } } },
        orderBy: { totalPoints: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: { isActive: true } }),
    ]);

    sendSuccess(res, users, undefined, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

router.post('/manual', checkRole(Role.SUPERADMIN), validate(manualPointSchema), async (req, res, next) => {
  try {
    const { userId, points, description } = req.body;

    await prisma.$transaction(async (tx) => {
      await tx.pointLog.create({
        data: { userId, points, description, refType: 'MANUAL' },
      });
      await tx.user.update({
        where: { id: userId },
        data: { totalPoints: { increment: points } },
      });
    });

    sendSuccess(res, null, 'Point berhasil ditambahkan');
  } catch (err) {
    next(err);
  }
});

export default router;
