import { Router } from 'express';
import { param } from '../../utils/param.js';
import { paginationSchema } from '@dakwah/shared';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, validate } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';

const router = Router();

router.use(checkAuth);

router.get('/', validate(paginationSchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId: req.user!.userId } }),
      prisma.notification.count({ where: { userId: req.user!.userId, isRead: false } }),
    ]);

    sendSuccess(res, { items: notifications, unreadCount }, undefined, 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/read', async (req, res, next) => {
  try {
    const notif = await prisma.notification.findFirst({
      where: { id: param(req.params.id), userId: req.user!.userId },
    });
    if (!notif) throw new AppError(404, 'Notifikasi tidak ditemukan');

    await prisma.notification.update({ where: { id: notif.id }, data: { isRead: true } });
    sendSuccess(res, null, 'Notifikasi ditandai sudah dibaca');
  } catch (err) {
    next(err);
  }
});

router.put('/read-all', async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, isRead: false },
      data: { isRead: true },
    });
    sendSuccess(res, null, 'Semua notifikasi ditandai sudah dibaca');
  } catch (err) {
    next(err);
  }
});

export default router;
