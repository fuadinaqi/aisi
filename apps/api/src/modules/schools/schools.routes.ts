import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { param } from '../../utils/param.js';
import {
  createSchoolWithPjSchema,
  invitePjSchema,
  createSchoolGroupSchema,
  paginationSchema,
  INVITATION_EXPIRE_DAYS,
} from '@dakwah/shared';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, checkRole, validate, canAccessSchool, getUserSchoolIds } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { Role, InvitationStatus } from '@prisma/client';
import { attachGroupAttendance } from '../../utils/attendance.js';
import { getMonday } from '../../utils/weekDate.js';
import { emailProvider } from '../../lib/email.js';
import { env } from '../../config/env.js';

const router = Router();

router.get('/', checkAuth, validate(paginationSchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const skip = (page - 1) * limit;
    const roles = req.user!.roles;
    const userId = req.user!.userId;

    let where: { isActive: boolean; id?: { in: string[] } } = { isActive: true };
    if (roles.includes(Role.PJ_SEKOLAH) && !roles.includes(Role.ADMIN) && !roles.includes(Role.SUPERADMIN)) {
      const schoolIds = await getUserSchoolIds(userId);
      where.id = { in: schoolIds };
    }

    const [schools, total] = await Promise.all([
      prisma.school.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      prisma.school.count({ where }),
    ]);
    sendSuccess(res, schools, undefined, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  checkAuth,
  checkRole(Role.SUPERADMIN, Role.ADMIN),
  validate(createSchoolWithPjSchema),
  async (req, res, next) => {
    try {
      const { name, city, pj } = req.body;

      const existingSchool = await prisma.school.findUnique({ where: { name } });
      if (existingSchool) throw new AppError(400, 'Nama sekolah sudah terdaftar');

      const existingUser = await prisma.user.findUnique({ where: { email: pj.email } });
      if (existingUser?.isActive) throw new AppError(400, 'Email PJ sudah terdaftar');

      const pendingInvite = await prisma.userInvitation.findFirst({
        where: {
          email: pj.email,
          status: InvitationStatus.PENDING,
          expiresAt: { gt: new Date() },
        },
      });
      if (pendingInvite) throw new AppError(400, 'Sudah ada undangan aktif untuk email PJ ini');

      const result = await prisma.$transaction(async (tx) => {
        const school = await tx.school.create({
          data: { name, city: city || 'Depok' },
        });

        if (pj.password) {
          const hashed = await bcrypt.hash(pj.password, 12);
          const pjUser = await tx.user.create({
            data: {
              name: pj.name,
              email: pj.email,
              phone: pj.phone || null,
              password: hashed,
              roles: { create: { role: Role.PJ_SEKOLAH } },
              schools: { create: { schoolId: school.id } },
            },
            select: { id: true, name: true, email: true, phone: true },
          });

          return { school, pjUser, invitation: null, mode: 'direct' as const };
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (env.INVITATION_EXPIRE_DAYS || INVITATION_EXPIRE_DAYS));

        const invitation = await tx.userInvitation.create({
          data: {
            name: pj.name,
            email: pj.email,
            role: Role.PJ_SEKOLAH,
            schoolId: school.id,
            invitedById: req.user!.userId,
            expiresAt,
          },
        });

        return { school, pjUser: null, invitation, mode: 'invite' as const };
      });

      if (result.mode === 'invite' && result.invitation) {
        const inviteLink = `${env.APP_URL}/set-password?token=${result.invitation.token}`;
        await emailProvider.sendInvitation(pj.email, pj.name, inviteLink);
      }

      sendSuccess(
        res,
        {
          school: result.school,
          pjUser: result.pjUser,
          invitation: result.invitation
            ? { id: result.invitation.id, email: result.invitation.email, status: result.invitation.status }
            : null,
          mode: result.mode,
        },
        result.mode === 'direct'
          ? 'Sekolah dan akun PJ Sekolah berhasil dibuat'
          : 'Sekolah berhasil dibuat. Undangan PJ Sekolah telah dikirim.',
        201,
      );
    } catch (err) {
      next(err);
    }
  },
);

router.put('/:id', checkAuth, checkRole(Role.SUPERADMIN, Role.ADMIN), async (req, res, next) => {
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

router.delete('/:id', checkAuth, checkRole(Role.SUPERADMIN, Role.ADMIN), async (req, res, next) => {
  try {
    await prisma.school.update({ where: { id: param(req.params.id) }, data: { isActive: false } });
    sendSuccess(res, null, 'Sekolah dinonaktifkan');
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:id/pj',
  checkAuth,
  checkRole(Role.SUPERADMIN, Role.ADMIN),
  validate(invitePjSchema),
  async (req, res, next) => {
    try {
      const schoolId = param(req.params.id);
      const { name, email, phone, password, replace, replaceUserId } = req.body;

      const school = await prisma.school.findUnique({ where: { id: schoolId } });
      if (!school || !school.isActive) throw new AppError(404, 'Sekolah tidak ditemukan');

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser?.isActive) throw new AppError(400, 'Email sudah terdaftar');

      const pendingInvite = await prisma.userInvitation.findFirst({
        where: {
          email,
          status: InvitationStatus.PENDING,
          expiresAt: { gt: new Date() },
        },
      });
      if (pendingInvite) throw new AppError(400, 'Sudah ada undangan aktif untuk email ini');

      if (replace && replaceUserId) {
        const targetLink = await prisma.userSchool.findFirst({
          where: {
            schoolId,
            userId: replaceUserId,
            user: { roles: { some: { role: Role.PJ_SEKOLAH } } },
          },
        });
        if (!targetLink) throw new AppError(404, 'PJ Sekolah tidak ditemukan di sekolah ini');
      }

      const result = await prisma.$transaction(async (tx) => {
        if (replace && replaceUserId) {
          await tx.userSchool.deleteMany({
            where: { schoolId, userId: replaceUserId },
          });
        } else if (replace) {
          const currentPjLinks = await tx.userSchool.findMany({
            where: {
              schoolId,
              user: { roles: { some: { role: Role.PJ_SEKOLAH } } },
            },
            select: { id: true },
          });
          if (currentPjLinks.length > 0) {
            await tx.userSchool.deleteMany({
              where: { id: { in: currentPjLinks.map((l) => l.id) } },
            });
          }
        }

        if (password) {
          const hashed = await bcrypt.hash(password, 12);
          const pjUser = await tx.user.create({
            data: {
              name,
              email,
              phone: phone || null,
              password: hashed,
              roles: { create: { role: Role.PJ_SEKOLAH } },
              schools: { create: { schoolId } },
            },
            select: { id: true, name: true, email: true, phone: true },
          });
          return { pjUser, invitation: null, mode: 'direct' as const };
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (env.INVITATION_EXPIRE_DAYS || INVITATION_EXPIRE_DAYS));

        const invitation = await tx.userInvitation.create({
          data: {
            name,
            email,
            role: Role.PJ_SEKOLAH,
            schoolId,
            invitedById: req.user!.userId,
            expiresAt,
          },
        });

        return { pjUser: null, invitation, mode: 'invite' as const };
      });

      if (result.mode === 'invite' && result.invitation) {
        const inviteLink = `${env.APP_URL}/set-password?token=${result.invitation.token}`;
        await emailProvider.sendInvitation(email, name, inviteLink);
      }

      sendSuccess(
        res,
        {
          pjUser: result.pjUser,
          invitation: result.invitation
            ? { id: result.invitation.id, email: result.invitation.email, status: result.invitation.status }
            : null,
          mode: result.mode,
        },
        result.mode === 'direct'
          ? replace
            ? replaceUserId
              ? 'PJ Sekolah berhasil diganti'
              : 'PJ Sekolah berhasil diganti'
            : 'PJ Sekolah berhasil ditambahkan'
          : replace
            ? 'Undangan PJ Sekolah pengganti telah dikirim'
            : 'Undangan PJ Sekolah telah dikirim',
        201,
      );
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id/pj/:userId',
  checkAuth,
  checkRole(Role.SUPERADMIN, Role.ADMIN),
  async (req, res, next) => {
    try {
      const schoolId = param(req.params.id);
      const userId = param(req.params.userId);

      const school = await prisma.school.findUnique({ where: { id: schoolId } });
      if (!school || !school.isActive) throw new AppError(404, 'Sekolah tidak ditemukan');

      const link = await prisma.userSchool.findFirst({
        where: {
          schoolId,
          userId,
          user: { roles: { some: { role: Role.PJ_SEKOLAH } } },
        },
      });
      if (!link) throw new AppError(404, 'PJ Sekolah tidak ditemukan di sekolah ini');

      const pjCount = await prisma.userSchool.count({
        where: {
          schoolId,
          user: { roles: { some: { role: Role.PJ_SEKOLAH } } },
        },
      });
      if (pjCount <= 1) {
        throw new AppError(400, 'Sekolah harus memiliki minimal 1 PJ Sekolah');
      }

      await prisma.userSchool.delete({ where: { id: link.id } });
      sendSuccess(res, null, 'PJ Sekolah berhasil dihapus dari sekolah');
    } catch (err) {
      next(err);
    }
  },
);

async function assertSchoolManager(userId: string, roles: string[], schoolId: string) {
  if (roles.includes(Role.SUPERADMIN) || roles.includes(Role.ADMIN)) return;
  const canAccess = await canAccessSchool(userId, roles, schoolId);
  if (!canAccess) throw new AppError(403, 'Akses ditolak');
}

async function findPembinaInSchool(schoolId: string, pembinaId: string) {
  return prisma.user.findFirst({
    where: {
      id: pembinaId,
      isActive: true,
      roles: { some: { role: Role.PEMBINA } },
      OR: [
        { schools: { some: { schoolId } } },
        { groupsAsPembina: { some: { schoolId, isActive: true } } },
      ],
    },
    select: { id: true, name: true, email: true },
  });
}

router.get('/:id/pembina', checkAuth, async (req, res, next) => {
  try {
    const schoolId = param(req.params.id);
    await assertSchoolManager(req.user!.userId, req.user!.roles, schoolId);

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school || !school.isActive) throw new AppError(404, 'Sekolah tidak ditemukan');

    const pembina = await prisma.user.findMany({
      where: {
        isActive: true,
        roles: { some: { role: Role.PEMBINA } },
        OR: [
          { schools: { some: { schoolId } } },
          { groupsAsPembina: { some: { schoolId, isActive: true } } },
        ],
      },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });

    sendSuccess(res, pembina);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:id/groups',
  checkAuth,
  validate(createSchoolGroupSchema),
  async (req, res, next) => {
    try {
      const schoolId = param(req.params.id);
      await assertSchoolManager(req.user!.userId, req.user!.roles, schoolId);

      const school = await prisma.school.findUnique({ where: { id: schoolId } });
      if (!school || !school.isActive) throw new AppError(404, 'Sekolah tidak ditemukan');

      const { name, level, pembinaId, pembina } = req.body;

      if (pembinaId) {
        const existingPembina = await findPembinaInSchool(schoolId, pembinaId);
        if (!existingPembina) throw new AppError(400, 'Pembina tidak ditemukan di sekolah ini');

        const group = await prisma.group.create({
          data: { name, level, schoolId, pembinaId },
          include: {
            pembina: { select: { id: true, name: true, email: true } },
            school: { select: { id: true, name: true } },
          },
        });

        sendSuccess(res, { group, pembina: existingPembina, mode: 'existing' }, 'Kelompok berhasil dibuat', 201);
        return;
      }

      const { name: pName, email, phone, password } = pembina!;
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser?.isActive) throw new AppError(400, 'Email pembina sudah terdaftar');

      const pendingInvite = await prisma.userInvitation.findFirst({
        where: {
          email,
          status: InvitationStatus.PENDING,
          expiresAt: { gt: new Date() },
        },
      });
      if (pendingInvite) throw new AppError(400, 'Sudah ada undangan aktif untuk email ini');

      if (password) {
        const hashed = await bcrypt.hash(password, 12);
        const result = await prisma.$transaction(async (tx) => {
          const newPembina = await tx.user.create({
            data: {
              name: pName,
              email,
              phone: phone || null,
              password: hashed,
              roles: { create: { role: Role.PEMBINA } },
              schools: { create: { schoolId } },
            },
            select: { id: true, name: true, email: true },
          });

          const group = await tx.group.create({
            data: { name, level, schoolId, pembinaId: newPembina.id },
            include: {
              pembina: { select: { id: true, name: true, email: true } },
              school: { select: { id: true, name: true } },
            },
          });

          return { group, pembina: newPembina };
        });

        sendSuccess(res, { ...result, mode: 'direct' }, 'Kelompok dan pembina berhasil dibuat', 201);
        return;
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (env.INVITATION_EXPIRE_DAYS || INVITATION_EXPIRE_DAYS));

      const invitation = await prisma.userInvitation.create({
        data: {
          name: pName,
          email,
          role: Role.PEMBINA,
          schoolId,
          invitedById: req.user!.userId,
          expiresAt,
        },
      });

      const inviteLink = `${env.APP_URL}/set-password?token=${invitation.token}`;
      await emailProvider.sendInvitation(email, pName, inviteLink);

      sendSuccess(
        res,
        {
          group: null,
          invitation: { id: invitation.id, email: invitation.email, status: invitation.status },
          mode: 'invite',
        },
        'Undangan pembina dikirim. Buat kelompok lagi setelah pembina aktif.',
        201,
      );
    } catch (err) {
      next(err);
    }
  },
);

router.get('/:id', checkAuth, async (req, res, next) => {
  try {
    const schoolId = param(req.params.id);
    const canAccess = await canAccessSchool(req.user!.userId, req.user!.roles, schoolId);
    if (!canAccess) throw new AppError(403, 'Akses ditolak');

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school || !school.isActive) throw new AppError(404, 'Sekolah tidak ditemukan');

    const [pjUsers, groupsRaw, totalAnggota, groupMembers, groupEvaluations] = await Promise.all([
      prisma.user.findMany({
        where: {
          isActive: true,
          schools: { some: { schoolId } },
          roles: { some: { role: Role.PJ_SEKOLAH } },
        },
        select: { id: true, name: true, email: true, phone: true },
        orderBy: { name: 'asc' },
      }),
      prisma.group.findMany({
        where: { schoolId, isActive: true },
        include: {
          pembina: { select: { id: true, name: true, email: true } },
          _count: { select: { members: { where: { isActive: true } } } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.groupMember.count({
        where: { group: { schoolId, isActive: true }, isActive: true },
      }),
      prisma.groupMember.findMany({
        where: { group: { schoolId, isActive: true }, isActive: true },
        select: { groupId: true, userId: true, joinedAt: true },
      }),
      prisma.weeklyEvaluation.findMany({
        where: { group: { schoolId, isActive: true }, isSubmitted: true },
        select: {
          groupId: true,
          weekDate: true,
          attendances: { select: { userId: true, status: true } },
        },
      }),
    ]);

    const groups = attachGroupAttendance(groupsRaw, groupMembers, groupEvaluations);

    sendSuccess(res, {
      ...school,
      pjUsers,
      groups,
      totalGroups: groups.length,
      totalAnggota,
    });
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
