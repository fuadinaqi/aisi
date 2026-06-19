import { Router } from 'express';
import { param } from '../../utils/param.js';
import { materiSchema, paginationSchema } from '@dakwah/shared';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, checkRole, validate } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { Role } from '@prisma/client';
import { getMonday } from '../../utils/weekDate.js';

const router = Router();

router.get('/', validate(paginationSchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const { weekDate } = req.query as { weekDate?: string };
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { isPublished: true };
    if (weekDate) where.weekDate = getMonday(new Date(weekDate));

    const [materi, total] = await Promise.all([
      prisma.weeklyMateri.findMany({ where, skip, take: limit, orderBy: { weekDate: 'desc' } }),
      prisma.weeklyMateri.count({ where }),
    ]);
    sendSuccess(res, materi, undefined, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

router.post('/', checkAuth, checkRole(Role.ADMIN, Role.SUPERADMIN), validate(materiSchema), async (req, res, next) => {
  try {
    const { weekDate, ...rest } = req.body;
    const materi = await prisma.weeklyMateri.create({
      data: { ...rest, weekDate: getMonday(new Date(weekDate)), createdById: req.user!.userId },
    });
    sendSuccess(res, materi, 'Materi berhasil dibuat', 201);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', checkAuth, checkRole(Role.ADMIN, Role.SUPERADMIN), async (req, res, next) => {
  try {
    const materi = await prisma.weeklyMateri.update({ where: { id: param(req.params.id) }, data: req.body });
    sendSuccess(res, materi, 'Materi berhasil diperbarui');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', checkAuth, checkRole(Role.ADMIN, Role.SUPERADMIN), async (req, res, next) => {
  try {
    await prisma.weeklyMateri.delete({ where: { id: param(req.params.id) } });
    sendSuccess(res, null, 'Materi berhasil dihapus');
  } catch (err) {
    next(err);
  }
});

export default router;
