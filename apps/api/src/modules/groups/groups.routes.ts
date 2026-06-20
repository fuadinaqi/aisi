import { Router } from 'express';
import { param } from '../../utils/param.js';
import { groupSchema, paginationSchema, updateGroupSchema, updateGroupMemberSchema } from '@dakwah/shared';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, checkRole, validate, getUserSchoolIds, isPembinaOfGroup, canAccessSchool } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { Role } from '@prisma/client';
import { computeMemberAttendance, computeGroupAttendance } from '../../utils/attendance.js';
import { assertGenderMatch } from '../../utils/gender.js';

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
          pembina: { select: { id: true, name: true, gender: true, phone: true } },
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
        pembina: { select: { id: true, name: true, email: true, gender: true, phone: true } },
        members: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                totalPoints: true,
                gender: true,
              },
            },
          },
        },
      },
    });
    if (!group) throw new AppError(404, 'Kelompok tidak ditemukan');

    const roles = req.user!.roles;
    if (!roles.includes('SUPERADMIN') && !roles.includes('ADMIN')) {
      const isOwner = group.pembinaId === req.user!.userId;
      const canSchool = await canAccessSchool(req.user!.userId, roles, group.schoolId);
      if (!isOwner && !canSchool) throw new AppError(403, 'Akses ditolak');
    }

    const submittedEvaluations = await prisma.weeklyEvaluation.findMany({
      where: { groupId: group.id, isSubmitted: true },
      select: {
        weekDate: true,
        attendances: { select: { userId: true, status: true } },
      },
      orderBy: { weekDate: 'asc' },
    });

    const membersWithStats = group.members.map((member) => {
      const stats = computeMemberAttendance(
        { userId: member.userId, joinedAt: member.joinedAt },
        submittedEvaluations,
      );
      return { ...member, ...stats };
    });

    const groupStats = computeGroupAttendance(
      group.createdAt,
      group.members.map((m) => ({ userId: m.userId, joinedAt: m.joinedAt })),
      submittedEvaluations,
    );

    sendSuccess(res, { ...group, ...groupStats, members: membersWithStats });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', validate(updateGroupSchema), async (req, res, next) => {
  try {
    const group = await prisma.group.findUnique({ where: { id: param(req.params.id) } });
    if (!group) throw new AppError(404, 'Kelompok tidak ditemukan');

    const roles = req.user!.roles;
    const isOwner = group.pembinaId === req.user!.userId;
    const canSchool = await canAccessSchool(req.user!.userId, roles, group.schoolId);
    if (!roles.includes('SUPERADMIN') && !roles.includes('ADMIN') && !isOwner && !canSchool) {
      throw new AppError(403, 'Akses ditolak');
    }

    const { name, level, gender, pembinaId, isActive } = req.body as {
      name?: string;
      level?: 'LEVEL_1' | 'LEVEL_2';
      gender?: 'IKHWAN' | 'AKHWAT';
      pembinaId?: string;
      isActive?: boolean;
    };

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (level !== undefined) data.level = level;
    if (gender !== undefined) data.gender = gender;
    if (isActive !== undefined) data.isActive = isActive;

    const targetGender = (gender ?? group.gender) as 'IKHWAN' | 'AKHWAT';

    if (pembinaId !== undefined && pembinaId !== group.pembinaId) {
      if (!roles.includes('PJ_SEKOLAH') && !roles.includes('ADMIN') && !roles.includes('SUPERADMIN')) {
        throw new AppError(403, 'Hanya PJ Sekolah atau Admin yang dapat mengganti pembina');
      }

      const pembina = await prisma.user.findFirst({
        where: {
          id: pembinaId,
          isActive: true,
          gender: targetGender,
          roles: { some: { role: Role.PEMBINA } },
          OR: [
            { schools: { some: { schoolId: group.schoolId } } },
            { groupsAsPembina: { some: { schoolId: group.schoolId, isActive: true } } },
          ],
        },
        select: { id: true },
      });
      if (!pembina) {
        throw new AppError(400, 'Pembina tidak valid untuk sekolah dan jenis kelompok ini');
      }
      data.pembinaId = pembinaId;
    }

    if (gender !== undefined && gender !== group.gender) {
      const [pembinaUser, memberCount] = await Promise.all([
        prisma.user.findUnique({ where: { id: group.pembinaId }, select: { gender: true } }),
        prisma.groupMember.count({ where: { groupId: group.id, isActive: true } }),
      ]);
      assertGenderMatch(pembinaUser?.gender, gender, 'Pembina kelompok');
      if (memberCount > 0) {
        throw new AppError(400, 'Jenis kelompok tidak dapat diubah karena masih ada anggota');
      }
    }

    const updated = await prisma.group.update({
      where: { id: param(req.params.id) },
      data,
      include: {
        school: { select: { id: true, name: true } },
        pembina: { select: { id: true, name: true, email: true } },
      },
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
      include: { user: { select: { id: true, name: true, email: true, phone: true, totalPoints: true } } },
    });
    sendSuccess(res, members);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/members', async (req, res, next) => {
  try {
    const { userId } = req.body;
    const groupId = param(req.params.id);
    const isOwner = await isPembinaOfGroup(req.user!.userId, groupId);
    const roles = req.user!.roles;
    if (!isOwner && !roles.includes('PJ_SEKOLAH') && !roles.includes('ADMIN') && !roles.includes('SUPERADMIN')) {
      throw new AppError(403, 'Akses ditolak');
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { gender: true },
    });
    if (!group) throw new AppError(404, 'Kelompok tidak ditemukan');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { gender: true },
    });
    if (!user) throw new AppError(404, 'User tidak ditemukan');
    assertGenderMatch(user.gender, group.gender, 'Anggota');

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

router.get('/:id/members/:userId', async (req, res, next) => {
  try {
    const groupId = param(req.params.id);
    const memberUserId = param(req.params.userId);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        school: { select: { id: true, name: true } },
      },
    });
    if (!group || !group.isActive) throw new AppError(404, 'Kelompok tidak ditemukan');

    const roles = req.user!.roles;
    if (!roles.includes('SUPERADMIN') && !roles.includes('ADMIN')) {
      const isOwner = group.pembinaId === req.user!.userId;
      const canSchool = await canAccessSchool(req.user!.userId, roles, group.schoolId);
      if (!isOwner && !canSchool) throw new AppError(403, 'Akses ditolak');
    }

    const member = await prisma.groupMember.findFirst({
      where: { groupId, userId: memberUserId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            gender: true,
            totalPoints: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
    });
    if (!member) throw new AppError(404, 'Anggota tidak ditemukan di kelompok ini');

    const submittedEvaluations = await prisma.weeklyEvaluation.findMany({
      where: { groupId, isSubmitted: true },
      select: {
        weekDate: true,
        attendances: { select: { userId: true, status: true } },
      },
      orderBy: { weekDate: 'asc' },
    });

    const stats = computeMemberAttendance(
      { userId: member.userId, joinedAt: member.joinedAt },
      submittedEvaluations,
    );

    sendSuccess(res, {
      joinedAt: member.joinedAt,
      ...stats,
      user: member.user,
      group: { id: group.id, name: group.name, level: group.level, gender: group.gender },
      school: group.school,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/members/:userId', validate(updateGroupMemberSchema), async (req, res, next) => {
  try {
    const groupId = param(req.params.id);
    const memberUserId = param(req.params.userId);
    const isOwner = await isPembinaOfGroup(req.user!.userId, groupId);
    const roles = req.user!.roles;
    if (!isOwner && !roles.includes('PJ_SEKOLAH') && !roles.includes('ADMIN') && !roles.includes('SUPERADMIN')) {
      throw new AppError(403, 'Akses ditolak');
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { school: { select: { id: true, name: true } } },
    });
    if (!group || !group.isActive) throw new AppError(404, 'Kelompok tidak ditemukan');

    const member = await prisma.groupMember.findFirst({
      where: { groupId, userId: memberUserId, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            roles: { select: { role: true } },
          },
        },
      },
    });
    if (!member) throw new AppError(404, 'Anggota tidak ditemukan di kelompok ini');
    if (!member.user.roles.some((r) => r.role === Role.ANGGOTA)) {
      throw new AppError(400, 'User bukan anggota');
    }

    const { name, email, phone, gender } = req.body as {
      name?: string;
      email?: string;
      phone?: string | null;
      gender?: 'IKHWAN' | 'AKHWAT';
    };

    if (email && email !== member.user.email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser && existingUser.id !== memberUserId) {
        throw new AppError(400, 'Email sudah digunakan');
      }
    }

    const userData: Record<string, unknown> = {};
    if (name !== undefined) userData.name = name;
    if (email !== undefined) userData.email = email;
    if (phone !== undefined) userData.phone = phone || null;
    if (gender !== undefined) {
      assertGenderMatch(gender, group.gender, 'Anggota');
      userData.gender = gender;
    }

    const updatedUser = await prisma.user.update({
      where: { id: memberUserId },
      data: userData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        gender: true,
        totalPoints: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    const submittedEvaluations = await prisma.weeklyEvaluation.findMany({
      where: { groupId, isSubmitted: true },
      select: {
        weekDate: true,
        attendances: { select: { userId: true, status: true } },
      },
      orderBy: { weekDate: 'asc' },
    });

    const stats = computeMemberAttendance(
      { userId: member.userId, joinedAt: member.joinedAt },
      submittedEvaluations,
    );

    sendSuccess(res, {
      joinedAt: member.joinedAt,
      ...stats,
      user: updatedUser,
      group: { id: group.id, name: group.name, level: group.level, gender: group.gender },
      school: group.school,
    }, 'Data anggota berhasil diperbarui');
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
