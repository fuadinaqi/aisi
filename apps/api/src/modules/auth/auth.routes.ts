import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { loginSchema, setPasswordSchema, changePasswordSchema } from '@dakwah/shared';
import { prisma } from '../../lib/prisma.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../../lib/jwt.js';
import { checkAuth, validate } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { param } from '../../utils/param.js';
import { env } from '../../config/env.js';
import { Role, InvitationStatus } from '@prisma/client';

const router = Router();

const REFRESH_COOKIE = 'refreshToken';

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: true },
    });

    if (!user || !user.isActive) throw new AppError(401, 'Email atau password salah');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new AppError(401, 'Email atau password salah');

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const roles = user.roles.map((r) => r.role);
    const accessToken = signAccessToken({ userId: user.id, email: user.email, roles });
    const refreshToken = await signRefreshToken(user.id);

    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    sendSuccess(res, {
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, roles, totalPoints: user.totalPoints },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) await revokeRefreshToken(token);
    res.clearCookie(REFRESH_COOKIE);
    sendSuccess(res, null, 'Logout berhasil');
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new AppError(401, 'Refresh token tidak ditemukan');

    const { userId, tokenId } = await verifyRefreshToken(token);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });
    if (!user || !user.isActive) throw new AppError(401, 'User tidak ditemukan');

    const roles = user.roles.map((r) => r.role);
    const accessToken = signAccessToken({ userId: user.id, email: user.email, roles });
    const newRefreshToken = await rotateRefreshToken(tokenId, user.id);

    res.cookie(REFRESH_COOKIE, newRefreshToken, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    sendSuccess(res, { accessToken });
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', checkAuth, validate(changePasswordSchema), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) throw new AppError(404, 'User tidak ditemukan');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new AppError(400, 'Password saat ini salah');

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
    sendSuccess(res, null, 'Password berhasil diubah');
  } catch (err) {
    next(err);
  }
});

router.get('/invitation/:token', async (req, res, next) => {
  try {
    const token = param(req.params.token);
    const invitation = await prisma.userInvitation.findUnique({ where: { token } });
    if (!invitation) throw new AppError(404, 'Undangan tidak ditemukan');

    if (invitation.status === InvitationStatus.USED) throw new AppError(400, 'Undangan sudah digunakan');
    if (invitation.expiresAt < new Date() || invitation.status === InvitationStatus.EXPIRED) {
      await prisma.userInvitation.update({ where: { id: invitation.id }, data: { status: InvitationStatus.EXPIRED } });
      throw new AppError(400, 'Undangan sudah expired');
    }

    sendSuccess(res, { name: invitation.name, email: invitation.email, role: invitation.role });
  } catch (err) {
    next(err);
  }
});

router.post('/set-password', validate(setPasswordSchema), async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const invitation = await prisma.userInvitation.findUnique({ where: { token } });
    if (!invitation) throw new AppError(404, 'Undangan tidak ditemukan');
    if (invitation.status === InvitationStatus.USED) throw new AppError(400, 'Undangan sudah digunakan');
    if (invitation.expiresAt < new Date()) {
      await prisma.userInvitation.update({ where: { id: invitation.id }, data: { status: InvitationStatus.EXPIRED } });
      throw new AppError(400, 'Undangan sudah expired');
    }

    const existing = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existing) throw new AppError(400, 'Email sudah terdaftar');

    const hashed = await bcrypt.hash(password, 12);

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: invitation.name,
          email: invitation.email,
          password: hashed,
          roles: { create: { role: invitation.role as Role } },
          ...(invitation.schoolId && {
            schools: { create: { schoolId: invitation.schoolId } },
          }),
        },
      });

      if (invitation.groupId && invitation.role === Role.ANGGOTA) {
        await tx.groupMember.create({
          data: { groupId: invitation.groupId, userId: user.id },
        });
      }

      await tx.userInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.USED, usedAt: new Date() },
      });
    });

    sendSuccess(res, null, 'Akun berhasil dibuat, silakan login');
  } catch (err) {
    next(err);
  }
});

export default router;
