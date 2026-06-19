import { Router } from 'express';
import { manualPointSchema, paginationSchema, isPointEligible } from '@dakwah/shared';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, checkRole, validate } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { assertCanGrantManualPoints } from '../../utils/pointPermissions.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(checkAuth);

router.get('/me', validate(paginationSchema, 'query'), async (req, res, next) => {
  try {
    if (!isPointEligible(req.user!.roles)) {
      sendSuccess(res, { totalPoints: 0, logs: [], eligible: false });
      return;
    }

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

    sendSuccess(res, { totalPoints: user?.totalPoints ?? 0, logs, eligible: true }, undefined, 200, {
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
        where: {
          isActive: true,
          roles: { some: { role: { in: [Role.PEMBINA, Role.ANGGOTA] } } },
        },
        select: { id: true, name: true, totalPoints: true, roles: { select: { role: true } } },
        orderBy: { totalPoints: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({
        where: {
          isActive: true,
          roles: { some: { role: { in: [Role.PEMBINA, Role.ANGGOTA] } } },
        },
      }),
    ]);

    sendSuccess(res, users, undefined, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/manual',
  checkRole(Role.SUPERADMIN, Role.ADMIN, Role.PJ_SEKOLAH, Role.PEMBINA),
  validate(manualPointSchema),
  async (req, res, next) => {
    try {
      const { userId, points, description } = req.body;

      if (points <= 0) {
        throw new AppError(400, 'Poin harus lebih dari 0');
      }

      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { roles: { select: { role: true } } },
      });
      if (!target) throw new AppError(404, 'User tidak ditemukan');

      const targetRoles = target.roles.map((r) => r.role);
      if (!isPointEligible(targetRoles)) {
        throw new AppError(400, 'Poin hanya berlaku untuk Pembina dan Anggota');
      }

      try {
        await assertCanGrantManualPoints(req.user!.userId, req.user!.roles, userId, targetRoles);
      } catch (err) {
        const code = err instanceof Error ? err.message : 'ROLE_DENIED';
        if (code === 'SELF_ADD') {
          throw new AppError(403, 'Tidak bisa menambah poin untuk diri sendiri');
        }
        if (code === 'SCOPE_DENIED') {
          throw new AppError(403, 'User target di luar cakupan Anda');
        }
        throw new AppError(403, 'Anda tidak berhak menambah poin untuk user ini');
      }

      await prisma.$transaction(async (tx) => {
        await tx.pointLog.create({
          data: {
            userId,
            points,
            description,
            refType: 'MANUAL',
            refId: req.user!.userId,
          },
        });
        await tx.user.update({
          where: { id: userId },
          data: { totalPoints: { increment: points } },
        });
      });

      sendSuccess(res, null, 'Poin berhasil ditambahkan');
    } catch (err) {
      next(err);
    }
  },
);

export default router;
