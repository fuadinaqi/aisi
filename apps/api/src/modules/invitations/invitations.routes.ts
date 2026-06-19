import { Router } from 'express';
import { param } from '../../utils/param.js';
import { invitationSchema, paginationSchema } from '@dakwah/shared';
import { INVITATION_RULES, INVITATION_EXPIRE_DAYS } from '@dakwah/shared';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, validate } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { emailProvider } from '../../lib/email.js';
import { env } from '../../config/env.js';
import { InvitationStatus, Role } from '@prisma/client';

const router = Router();

router.use(checkAuth);

router.post('/', validate(invitationSchema), async (req, res, next) => {
  try {
    const { name, email, role, schoolId, groupId } = req.body;
    const inviterRoles = req.user!.roles;

    const canInvite = inviterRoles.some((r) => {
      const allowed = INVITATION_RULES[r];
      return allowed?.includes(role);
    });
    if (!canInvite) throw new AppError(403, 'Anda tidak berhak mengundang role ini');

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser?.isActive) throw new AppError(400, 'Email sudah terdaftar sebagai user aktif');

    const pendingInvite = await prisma.userInvitation.findFirst({
      where: { email, status: InvitationStatus.PENDING, expiresAt: { gt: new Date() } },
    });
    if (pendingInvite) throw new AppError(400, 'Sudah ada undangan PENDING untuk email ini');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (env.INVITATION_EXPIRE_DAYS || INVITATION_EXPIRE_DAYS));

    const invitation = await prisma.userInvitation.create({
      data: {
        name,
        email,
        role: role as Role,
        schoolId: schoolId || null,
        groupId: groupId || null,
        invitedById: req.user!.userId,
        expiresAt,
      },
    });

    const inviteLink = `${env.APP_URL}/set-password?token=${invitation.token}`;
    await emailProvider.sendInvitation(email, name, inviteLink);

    sendSuccess(res, invitation, 'Undangan berhasil dikirim', 201);
  } catch (err) {
    next(err);
  }
});

router.get('/', validate(paginationSchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.userInvitation.findMany({
        where: { invitedById: req.user!.userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.userInvitation.count({ where: { invitedById: req.user!.userId } }),
    ]);

    sendSuccess(res, items, undefined, 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/resend', async (req, res, next) => {
  try {
    const invitation = await prisma.userInvitation.findFirst({
      where: { id: param(req.params.id), invitedById: req.user!.userId },
    });
    if (!invitation) throw new AppError(404, 'Undangan tidak ditemukan');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.INVITATION_EXPIRE_DAYS);

    const updated = await prisma.userInvitation.update({
      where: { id: invitation.id },
      data: { status: InvitationStatus.PENDING, expiresAt },
    });

    const inviteLink = `${env.APP_URL}/set-password?token=${updated.token}`;
    await emailProvider.sendInvitation(updated.email, updated.name, inviteLink);

    sendSuccess(res, updated, 'Undangan berhasil dikirim ulang');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const invitation = await prisma.userInvitation.findFirst({
      where: { id: param(req.params.id), invitedById: req.user!.userId, status: InvitationStatus.PENDING },
    });
    if (!invitation) throw new AppError(404, 'Undangan tidak ditemukan');

    await prisma.userInvitation.delete({ where: { id: invitation.id } });
    sendSuccess(res, null, 'Undangan dibatalkan');
  } catch (err) {
    next(err);
  }
});

export default router;
