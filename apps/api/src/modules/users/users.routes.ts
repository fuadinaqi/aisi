import { Router } from 'express';
import { param } from '../../utils/param.js';
import { paginationSchema } from '@dakwah/shared';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, checkRole, validate, getUserSchoolIds } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { Role } from '@prisma/client';

const router = Router();

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatarUrl: true,
  totalPoints: true,
  isActive: true,
  createdAt: true,
  lastLoginAt: true,
  roles: { select: { role: true } },
  schools: { include: { school: { select: { id: true, name: true } } } },
} as const;

router.get('/leaderboard', checkAuth, validate(paginationSchema, 'query'), async (req, res, next) => {
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

router.get('/me', checkAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: userSelect,
    });
    if (!user) throw new AppError(404, 'User tidak ditemukan');
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
});

router.put('/me', checkAuth, async (req, res, next) => {
  try {
    const { name, phone, avatarUrl } = req.body;
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { ...(name && { name }), ...(phone !== undefined && { phone }), ...(avatarUrl !== undefined && { avatarUrl }) },
      select: userSelect,
    });
    sendSuccess(res, user, 'Profil berhasil diperbarui');
  } catch (err) {
    next(err);
  }
});

router.get('/', checkAuth, checkRole(Role.SUPERADMIN), validate(paginationSchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      prisma.user.findMany({ select: userSelect, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.user.count(),
    ]);
    sendSuccess(res, users, undefined, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', checkAuth, async (req, res, next) => {
  try {
    const roles = req.user!.roles;
    const user = await prisma.user.findUnique({ where: { id: param(req.params.id) }, select: userSelect });
    if (!user) throw new AppError(404, 'User tidak ditemukan');

    if (!roles.includes('SUPERADMIN') && !roles.includes('ADMIN')) {
      if (roles.includes('PJ_SEKOLAH')) {
        const schoolIds = await getUserSchoolIds(req.user!.userId);
        const userSchoolIds = user.schools.map((s) => s.school.id);
        if (!userSchoolIds.some((id) => schoolIds.includes(id))) {
          throw new AppError(403, 'Akses ditolak');
        }
      } else {
        throw new AppError(403, 'Akses ditolak');
      }
    }

    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', checkAuth, checkRole(Role.SUPERADMIN), async (req, res, next) => {
  try {
    const { name, phone, isActive } = req.body;
    const user = await prisma.user.update({
      where: { id: param(req.params.id) },
      data: { ...(name && { name }), ...(phone !== undefined && { phone }), ...(isActive !== undefined && { isActive }) },
      select: userSelect,
    });
    sendSuccess(res, user, 'User berhasil diperbarui');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', checkAuth, checkRole(Role.SUPERADMIN), async (req, res, next) => {
  try {
    await prisma.user.update({ where: { id: param(req.params.id) }, data: { isActive: false } });
    sendSuccess(res, null, 'User dinonaktifkan');
  } catch (err) {
    next(err);
  }
});

export default router;
