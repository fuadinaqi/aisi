import { Router } from 'express';
import { createKksSchema, kksListQuerySchema, updateKksSchema } from '@dakwah/shared';
import { FeedbackStatus, FeedbackType, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, checkRole, validate } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { param } from '../../utils/param.js';
import { getUserSchoolIds } from '../../middleware/auth.js';

const router = Router();

router.use(checkAuth);

function isAdminRole(roles: string[]) {
  return roles.includes('SUPERADMIN') || roles.includes('ADMIN');
}

async function notifyAdmins(feedbackId: string, subject: string, type: string) {
  const adminRoles = await prisma.userRole.findMany({
    where: { role: { in: ['SUPERADMIN', 'ADMIN'] } },
    select: { userId: true },
    distinct: ['userId'],
  });

  if (adminRoles.length === 0) return;

  const typeLabel = type === 'KELUHAN' ? 'Keluhan' : type === 'KRITIK' ? 'Kritik' : 'Saran';

  await prisma.notification.createMany({
    data: adminRoles.map(({ userId }) => ({
      userId,
      type: 'NEW_KKS',
      title: `${typeLabel} baru`,
      body: subject,
      refId: feedbackId,
    })),
  });
}

router.get('/', validate(kksListQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit, status, type, mine } = req.query as unknown as {
      page: number;
      limit: number;
      status?: string;
      type?: string;
      mine?: boolean;
    };
    const skip = (page - 1) * limit;
    const roles = req.user!.roles;
    const isAdmin = isAdminRole(roles);

    const where: Prisma.FeedbackWhereInput = {};

    if (mine || !isAdmin) {
      where.userId = req.user!.userId;
    }
    if (status) where.status = status as FeedbackStatus;
    if (type) where.type = type as FeedbackType;

    const [items, total, pendingCount] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              roles: { select: { role: true } },
              schools: { select: { school: { select: { id: true, name: true } } } },
            },
          },
        },
      }),
      prisma.feedback.count({ where }),
      isAdmin
        ? prisma.feedback.count({ where: { status: 'PENDING' } })
        : prisma.feedback.count({ where: { userId: req.user!.userId, status: 'PENDING' } }),
    ]);

    sendSuccess(res, { items, pendingCount }, undefined, 200, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const feedback = await prisma.feedback.findUnique({
      where: { id: param(req.params.id) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            roles: { select: { role: true } },
            schools: { select: { school: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    if (!feedback) throw new AppError(404, 'KKS tidak ditemukan');

    const isAdmin = isAdminRole(req.user!.roles);
    if (!isAdmin && feedback.userId !== req.user!.userId) {
      throw new AppError(403, 'Akses ditolak');
    }

    sendSuccess(res, feedback);
  } catch (err) {
    next(err);
  }
});

router.post('/', validate(createKksSchema), async (req, res, next) => {
  try {
    const { type, subject, message } = req.body;
    const schoolIds = await getUserSchoolIds(req.user!.userId);

    const feedback = await prisma.feedback.create({
      data: {
        userId: req.user!.userId,
        type,
        subject,
        message,
        schoolId: schoolIds[0] ?? null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await notifyAdmins(feedback.id, subject, type);

    sendSuccess(res, feedback, 'KKS berhasil dikirim', 201);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', checkRole('SUPERADMIN', 'ADMIN'), validate(updateKksSchema), async (req, res, next) => {
  try {
    const existing = await prisma.feedback.findUnique({ where: { id: param(req.params.id) } });
    if (!existing) throw new AppError(404, 'KKS tidak ditemukan');

    const { status, adminNotes } = req.body;
    const now = new Date();
    const data: {
      status?: 'PENDING' | 'READ' | 'RESOLVED';
      adminNotes?: string | null;
      readAt?: Date | null;
      resolvedAt?: Date | null;
    } = {};

    if (adminNotes !== undefined) data.adminNotes = adminNotes;
    if (status) {
      data.status = status;
      if (status === 'READ' && existing.status === 'PENDING') {
        data.readAt = now;
      }
      if (status === 'RESOLVED') {
        data.resolvedAt = now;
        if (!existing.readAt) data.readAt = now;
      }
      if (status === 'PENDING') {
        data.readAt = null;
        data.resolvedAt = null;
      }
    }

    const feedback = await prisma.feedback.update({
      where: { id: existing.id },
      data,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            roles: { select: { role: true } },
            schools: { select: { school: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    sendSuccess(res, feedback, 'KKS diperbarui');
  } catch (err) {
    next(err);
  }
});

export default router;
