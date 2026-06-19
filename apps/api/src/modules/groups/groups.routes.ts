import { Router } from 'express';
import { param } from '../../utils/param.js';
import { groupSchema, paginationSchema } from '@dakwah/shared';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, checkRole, validate, getUserSchoolIds, isPembinaOfGroup, canAccessSchool } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { Role } from '@prisma/client';

const router = Router();

router.use(checkAuth);

router.get('/', validate(paginationSchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const skip = (page - 1) * limit;
    const roles = req.user!.roles;
    const userId = req.user!.userId;

    let where: Record<string, unknown> = { isActive: true };

    if (roles.includes('PEMBINA') && !roles.includes('ADMIN') && !roles.includes('SUPERADMIN')) {
      where = { ...where, pembinaId: userId };
    } else if (roles.includes('PJ_SEKOLAH') && !roles.includes('ADMIN') && !roles.includes('SUPERADMIN')) {
      const schoolIds = await getUserSchoolIds(userId);
      where = { ...where, schoolId: { in: schoolIds } };
    }

    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where,
        include: {
          school: { select: { id: true, name: true } },
          pembina: { select: { id: true, name: true } },
          _count: { select: { members: true } },
        },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.group.count({ where }),
    ]);

    sendSuccess(res, groups, undefined, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

router.post('/', checkRole(Role.PEMBINA, Role.PJ_SEKOLAH, Role.ADMIN, Role.SUPERADMIN), validate(groupSchema), async (req, res, next) => {
  try {
    const group = await prisma.group.create({
      data: req.body,
      include: { school: true, pembina: { select: { id: true, name: true } } },
    });
    sendSuccess(res, group, 'Kelompok berhasil dibuat', 201);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const group = await prisma.group.findUnique({
      where: { id: param(req.params.id) },
      include: {
        school: true,
        pembina: { select: { id: true, name: true, email: true } },
        members: { where: { isActive: true }, include: { user: { select: { id: true, name: true, email: true, totalPoints: true } } } },
      },
    });
    if (!group) throw new AppError(404, 'Kelompok tidak ditemukan');

    const roles = req.user!.roles;
    if (!roles.includes('SUPERADMIN') && !roles.includes('ADMIN')) {
      const isOwner = group.pembinaId === req.user!.userId;
      const canSchool = await canAccessSchool(req.user!.userId, roles, group.schoolId);
      if (!isOwner && !canSchool) throw new AppError(403, 'Akses ditolak');
    }

    sendSuccess(res, group);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const group = await prisma.group.findUnique({ where: { id: param(req.params.id) } });
    if (!group) throw new AppError(404, 'Kelompok tidak ditemukan');

    const roles = req.user!.roles;
    const isOwner = group.pembinaId === req.user!.userId;
    const canSchool = await canAccessSchool(req.user!.userId, roles, group.schoolId);
    if (!roles.includes('SUPERADMIN') && !roles.includes('ADMIN') && !isOwner && !canSchool) {
      throw new AppError(403, 'Akses ditolak');
    }

    const { name, level, isActive } = req.body;
    const updated = await prisma.group.update({
      where: { id: param(req.params.id) },
      data: { ...(name && { name }), ...(level && { level }), ...(isActive !== undefined && { isActive }) },
    });
    sendSuccess(res, updated, 'Kelompok berhasil diperbarui');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', checkRole(Role.PJ_SEKOLAH, Role.ADMIN, Role.SUPERADMIN), async (req, res, next) => {
  try {
    await prisma.group.update({ where: { id: param(req.params.id) }, data: { isActive: false } });
    sendSuccess(res, null, 'Kelompok dinonaktifkan');
  } catch (err) {
    next(err);
  }
});

router.get('/:id/members', async (req, res, next) => {
  try {
    const members = await prisma.groupMember.findMany({
      where: { groupId: param(req.params.id), isActive: true },
      include: { user: { select: { id: true, name: true, email: true, totalPoints: true } } },
    });
    sendSuccess(res, members);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/members', async (req, res, next) => {
  try {
    const { userId } = req.body;
    const isOwner = await isPembinaOfGroup(req.user!.userId, param(req.params.id));
    const roles = req.user!.roles;
    if (!isOwner && !roles.includes('PJ_SEKOLAH') && !roles.includes('ADMIN') && !roles.includes('SUPERADMIN')) {
      throw new AppError(403, 'Akses ditolak');
    }

    const member = await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: param(req.params.id), userId } },
      update: { isActive: true },
      create: { groupId: param(req.params.id), userId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    sendSuccess(res, member, 'Anggota berhasil ditambahkan', 201);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/members/:userId', async (req, res, next) => {
  try {
    const isOwner = await isPembinaOfGroup(req.user!.userId, param(req.params.id));
    const roles = req.user!.roles;
    if (!isOwner && !roles.includes('PJ_SEKOLAH') && !roles.includes('ADMIN') && !roles.includes('SUPERADMIN')) {
      throw new AppError(403, 'Akses ditolak');
    }

    await prisma.groupMember.update({
      where: { groupId_userId: { groupId: param(req.params.id), userId: param(req.params.userId) } },
      data: { isActive: false },
    });
    sendSuccess(res, null, 'Anggota berhasil dihapus');
  } catch (err) {
    next(err);
  }
});

export default router;
