import { Router } from 'express';
import { param } from '../../utils/param.js';
import { schoolSchema, paginationSchema } from '@dakwah/shared';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, checkRole, validate, canAccessSchool } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { Role } from '@prisma/client';
import { getMonday } from '../../utils/weekDate.js';

const router = Router();

router.get('/', checkAuth, validate(paginationSchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const skip = (page - 1) * limit;
    const [schools, total] = await Promise.all([
      prisma.school.findMany({ where: { isActive: true }, skip, take: limit, orderBy: { name: 'asc' } }),
      prisma.school.count({ where: { isActive: true } }),
    ]);
    sendSuccess(res, schools, undefined, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

router.post('/', checkAuth, checkRole(Role.SUPERADMIN), validate(schoolSchema), async (req, res, next) => {
  try {
    const school = await prisma.school.create({ data: req.body });
    sendSuccess(res, school, 'Sekolah berhasil dibuat', 201);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', checkAuth, checkRole(Role.SUPERADMIN), async (req, res, next) => {
  try {
    const { name, city, isActive } = req.body;
    const school = await prisma.school.update({
      where: { id: param(req.params.id) },
      data: { ...(name && { name }), ...(city && { city }), ...(isActive !== undefined && { isActive }) },
    });
    sendSuccess(res, school, 'Sekolah berhasil diperbarui');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', checkAuth, checkRole(Role.SUPERADMIN), async (req, res, next) => {
  try {
    await prisma.school.update({ where: { id: param(req.params.id) }, data: { isActive: false } });
    sendSuccess(res, null, 'Sekolah dinonaktifkan');
  } catch (err) {
    next(err);
  }
});

router.get('/:id/stats', checkAuth, async (req, res, next) => {
  try {
    const canAccess = await canAccessSchool(req.user!.userId, req.user!.roles, param(req.params.id));
    if (!canAccess) throw new AppError(403, 'Akses ditolak');

    const thisMonday = getMonday(new Date());
    const [groups, pembinaCount, anggotaCount, evaluationsThisWeek, totalEvaluations] = await Promise.all([
      prisma.group.count({ where: { schoolId: param(req.params.id), isActive: true } }),
      prisma.group.count({ where: { schoolId: param(req.params.id), isActive: true } }),
      prisma.groupMember.count({
        where: { group: { schoolId: param(req.params.id), isActive: true }, isActive: true },
      }),
      prisma.weeklyEvaluation.count({
        where: { group: { schoolId: param(req.params.id) }, weekDate: thisMonday, isSubmitted: true },
      }),
      prisma.weeklyEvaluation.count({
        where: { group: { schoolId: param(req.params.id) }, isSubmitted: true },
      }),
    ]);

    sendSuccess(res, {
      totalGroups: groups,
      totalPembina: pembinaCount,
      totalAnggota: anggotaCount,
      evaluationsThisWeek,
      totalEvaluations,
      submissionRate: groups > 0 ? Math.round((evaluationsThisWeek / groups) * 100) : 0,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
