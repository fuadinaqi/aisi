import { Router } from 'express';
import { param } from '../../utils/param.js';
import { paginationSchema, eventSchema, rejectEventCheckInSchema } from '@dakwah/shared';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, checkRole, validate, getUserSchoolIds, isPembinaOfGroup } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { upload, getPublicUrl } from '../../lib/storage.js';
import { EventCheckInStatus, GroupLevel, Role } from '@prisma/client';

const router = Router();

router.use(checkAuth);

function parseTargetLevels(value: unknown): GroupLevel[] {
  if (value === undefined || value === null || value === '' || value === 'all') return [];
  if (Array.isArray(value)) {
    return value.filter((v): v is GroupLevel => v === 'LEVEL_1' || v === 'LEVEL_2');
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is GroupLevel => v === 'LEVEL_1' || v === 'LEVEL_2');
      }
    } catch {
      if (value === 'LEVEL_1' || value === 'LEVEL_2') return [value];
    }
  }
  return [];
}

async function getUserGroupLevels(userId: string, roles: string[]): Promise<GroupLevel[]> {
  if (roles.includes('PJ_SEKOLAH')) {
    const schoolIds = await getUserSchoolIds(userId);
    const groups = await prisma.group.findMany({
      where: { schoolId: { in: schoolIds }, isActive: true },
      select: { level: true },
    });
    return [...new Set(groups.map((g) => g.level))];
  }

  if (roles.includes('PEMBINA')) {
    const groups = await prisma.group.findMany({
      where: { pembinaId: userId, isActive: true },
      select: { level: true },
    });
    return [...new Set(groups.map((g) => g.level))];
  }

  if (roles.includes('ANGGOTA')) {
    const memberships = await prisma.groupMember.findMany({
      where: { userId, isActive: true },
      include: { group: { select: { level: true } } },
    });
    return [...new Set(memberships.map((m) => m.group.level))];
  }

  return [];
}

async function buildEventVisibilityWhere(userId: string, roles: string[]) {
  const now = new Date();
  const base = {
    isPublished: true,
    endAt: { gte: now },
  };

  if (roles.includes('SUPERADMIN') || roles.includes('ADMIN')) {
    return base;
  }

  let schoolIds: string[] = [];

  if (roles.includes('PJ_SEKOLAH')) {
    schoolIds = await getUserSchoolIds(userId);
  } else if (roles.includes('PEMBINA')) {
    const groups = await prisma.group.findMany({
      where: { pembinaId: userId, isActive: true },
      select: { schoolId: true },
    });
    schoolIds = [...new Set(groups.map((g) => g.schoolId))];
  } else if (roles.includes('ANGGOTA')) {
    const memberships = await prisma.groupMember.findMany({
      where: { userId, isActive: true },
      include: { group: { select: { schoolId: true } } },
    });
    schoolIds = [...new Set(memberships.map((m) => m.group.schoolId))];
  }

  const userLevels = await getUserGroupLevels(userId, roles);
  const schoolFilter = { OR: [{ schoolId: null }, { schoolId: { in: schoolIds } }] };
  const levelFilter =
    userLevels.length > 0
      ? {
          OR: [{ targetLevels: { isEmpty: true } }, { targetLevels: { hasSome: userLevels } }],
        }
      : { targetLevels: { isEmpty: true } };

  return {
    AND: [base, schoolFilter, levelFilter],
  };
}

async function resolveAnggotaGroup(
  userId: string,
  schoolId: string | null,
  targetLevels: GroupLevel[],
) {
  const memberships = await prisma.groupMember.findMany({
    where: {
      userId,
      isActive: true,
      group: {
        isActive: true,
        ...(schoolId ? { schoolId } : {}),
      },
    },
    include: { group: { select: { id: true, schoolId: true, pembinaId: true, level: true } } },
  });

  const eligible = targetLevels.length
    ? memberships.filter((m) => targetLevels.includes(m.group.level))
    : memberships;

  if (!eligible.length) {
    throw new AppError(400, 'Event ini tidak tersedia untuk level kelompok Anda');
  }

  return eligible[0]!;
}

function isEventOngoing(startAt: Date, endAt: Date, now = new Date()) {
  return now >= startAt && now <= endAt;
}

function parseEventBody(body: Record<string, unknown>) {
  return eventSchema.parse({
    title: body.title,
    description: body.description || undefined,
    location: body.location || undefined,
    startAt: body.startAt,
    endAt: body.endAt,
    pointValue: body.pointValue !== undefined ? Number(body.pointValue) : 0,
    imageUrl: body.imageUrl || undefined,
    schoolId: body.schoolId === '' || body.schoolId === 'all' ? null : body.schoolId || undefined,
    targetLevels: parseTargetLevels(body.targetLevels),
    isPublished: body.isPublished === undefined ? true : body.isPublished === true || body.isPublished === 'true',
  });
}

router.get('/', validate(paginationSchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const skip = (page - 1) * limit;
    const userId = req.user!.userId;
    const roles = req.user!.roles;
    const where = await buildEventVisibilityWhere(userId, roles);

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        include: {
          school: { select: { id: true, name: true } },
          attendances: {
            where: { userId },
            select: { id: true, status: true, checkedAt: true, photoUrl: true },
          },
        },
        skip,
        take: limit,
        orderBy: { startAt: 'asc' },
      }),
      prisma.event.count({ where }),
    ]);

    const data = events.map(({ attendances, ...event }) => ({
      ...event,
      myCheckIn: attendances[0] ?? null,
    }));

    sendSuccess(res, data, undefined, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

router.get('/check-ins/pending', checkRole(Role.PEMBINA), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const groups = await prisma.group.findMany({
      where: { pembinaId: userId, isActive: true },
      select: { id: true },
    });
    const groupIds = groups.map((g) => g.id);
    if (!groupIds.length) {
      sendSuccess(res, []);
      return;
    }

    const pending = await prisma.eventAttendance.findMany({
      where: { groupId: { in: groupIds }, status: EventCheckInStatus.PENDING },
      include: {
        user: { select: { id: true, name: true, email: true } },
        event: {
          select: {
            id: true,
            title: true,
            startAt: true,
            endAt: true,
            pointValue: true,
            location: true,
          },
        },
        group: { select: { id: true, name: true } },
      },
      orderBy: { checkedAt: 'asc' },
    });

    sendSuccess(res, pending);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  checkRole(Role.ADMIN, Role.SUPERADMIN, Role.PJ_SEKOLAH),
  upload.single('image'),
  async (req, res, next) => {
    try {
      const roles = req.user!.roles;
      const parsed = parseEventBody(req.body as Record<string, unknown>);

      let schoolId = parsed.schoolId ?? null;
      if (roles.includes('PJ_SEKOLAH') && !roles.includes('ADMIN') && !roles.includes('SUPERADMIN')) {
        const schoolIds = await getUserSchoolIds(req.user!.userId);
        if (!schoolIds.length) throw new AppError(400, 'PJ belum terhubung ke sekolah');
        schoolId = schoolIds[0]!;
      }

      const imageUrl = req.file ? getPublicUrl(req.file.filename) : parsed.imageUrl;

      const event = await prisma.event.create({
        data: {
          title: parsed.title,
          description: parsed.description,
          location: parsed.location,
          startAt: parsed.startAt,
          endAt: parsed.endAt,
          pointValue: parsed.pointValue,
          imageUrl,
          schoolId,
          targetLevels: parsed.targetLevels,
          isPublished: parsed.isPublished,
          createdById: req.user!.userId,
        },
        include: { school: { select: { id: true, name: true } } },
      });

      sendSuccess(res, event, 'Event berhasil dibuat', 201);
    } catch (err) {
      next(err);
    }
  },
);

router.post('/check-ins/:attendanceId/approve', checkRole(Role.PEMBINA), async (req, res, next) => {
  try {
    const attendanceId = param(req.params.attendanceId);
    const attendance = await prisma.eventAttendance.findUnique({
      where: { id: attendanceId },
      include: { event: true, group: true },
    });
    if (!attendance) throw new AppError(404, 'Check-in tidak ditemukan');
    if (attendance.status !== EventCheckInStatus.PENDING) {
      throw new AppError(400, 'Check-in sudah diproses');
    }

    const isOwner = await isPembinaOfGroup(req.user!.userId, attendance.groupId);
    if (!isOwner) throw new AppError(403, 'Hanya pembina kelompok terkait yang dapat menyetujui');

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.eventAttendance.update({
        where: { id: attendanceId },
        data: {
          status: EventCheckInStatus.APPROVED,
          approvedById: req.user!.userId,
          approvedAt: new Date(),
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          event: { select: { id: true, title: true, pointValue: true } },
          group: { select: { id: true, name: true } },
        },
      });

      if (attendance.event.pointValue > 0) {
        await tx.user.update({
          where: { id: attendance.userId },
          data: { totalPoints: { increment: attendance.event.pointValue } },
        });
        await tx.pointLog.create({
          data: {
            userId: attendance.userId,
            points: attendance.event.pointValue,
            description: `Check-in event: ${attendance.event.title}`,
            refType: 'EVENT_CHECKIN',
            refId: attendance.id,
          },
        });
      }

      return result;
    });

    sendSuccess(res, updated, 'Check-in disetujui');
  } catch (err) {
    next(err);
  }
});

router.post(
  '/check-ins/:attendanceId/reject',
  checkRole(Role.PEMBINA),
  validate(rejectEventCheckInSchema),
  async (req, res, next) => {
    try {
      const attendanceId = param(req.params.attendanceId);
      const attendance = await prisma.eventAttendance.findUnique({
        where: { id: attendanceId },
      });
      if (!attendance) throw new AppError(404, 'Check-in tidak ditemukan');
      if (attendance.status !== EventCheckInStatus.PENDING) {
        throw new AppError(400, 'Check-in sudah diproses');
      }

      const isOwner = await isPembinaOfGroup(req.user!.userId, attendance.groupId);
      if (!isOwner) throw new AppError(403, 'Hanya pembina kelompok terkait yang dapat menolak');

      const { rejectionNote } = req.body as { rejectionNote?: string };
      const updated = await prisma.eventAttendance.update({
        where: { id: attendanceId },
        data: {
          status: EventCheckInStatus.REJECTED,
          approvedById: req.user!.userId,
          approvedAt: new Date(),
          rejectionNote: rejectionNote || null,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          event: { select: { id: true, title: true } },
          group: { select: { id: true, name: true } },
        },
      });

      sendSuccess(res, updated, 'Check-in ditolak');
    } catch (err) {
      next(err);
    }
  },
);

router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const roles = req.user!.roles;
    const where = await buildEventVisibilityWhere(userId, roles);

    const event = await prisma.event.findFirst({
      where: { id: param(req.params.id), ...where },
      include: {
        school: { select: { id: true, name: true } },
        attendances: {
          where: { userId },
          select: {
            id: true,
            status: true,
            checkedAt: true,
            photoUrl: true,
            approvedAt: true,
            rejectionNote: true,
          },
        },
      },
    });
    if (!event) throw new AppError(404, 'Event tidak ditemukan');

    const { attendances, ...rest } = event;
    const now = new Date();
    sendSuccess(res, {
      ...rest,
      myCheckIn: attendances[0] ?? null,
      isOngoing: isEventOngoing(event.startAt, event.endAt, now),
      hasEnded: now > event.endAt,
      hasStarted: now >= event.startAt,
    });
  } catch (err) {
    next(err);
  }
});

router.put(
  '/:id',
  checkRole(Role.ADMIN, Role.SUPERADMIN, Role.PJ_SEKOLAH),
  upload.single('image'),
  async (req, res, next) => {
    try {
      const event = await prisma.event.findUnique({ where: { id: param(req.params.id) } });
      if (!event) throw new AppError(404, 'Event tidak ditemukan');

      const roles = req.user!.roles;
      if (roles.includes('PJ_SEKOLAH') && !roles.includes('ADMIN') && !roles.includes('SUPERADMIN')) {
        const schoolIds = await getUserSchoolIds(req.user!.userId);
        if (!event.schoolId || !schoolIds.includes(event.schoolId)) {
          throw new AppError(403, 'Akses ditolak');
        }
      }

      const parsed = parseEventBody(req.body as Record<string, unknown>);
      const imageUrl = req.file ? getPublicUrl(req.file.filename) : parsed.imageUrl ?? event.imageUrl;

      const updated = await prisma.event.update({
        where: { id: param(req.params.id) },
        data: {
          title: parsed.title,
          description: parsed.description,
          location: parsed.location,
          startAt: parsed.startAt,
          endAt: parsed.endAt,
          pointValue: parsed.pointValue,
          imageUrl,
          isPublished: parsed.isPublished,
          targetLevels: parsed.targetLevels,
        },
        include: { school: { select: { id: true, name: true } } },
      });

      sendSuccess(res, updated, 'Event berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/:id', checkRole(Role.ADMIN, Role.SUPERADMIN, Role.PJ_SEKOLAH), async (req, res, next) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: param(req.params.id) } });
    if (!event) throw new AppError(404, 'Event tidak ditemukan');

    const roles = req.user!.roles;
    if (roles.includes('PJ_SEKOLAH') && !roles.includes('ADMIN') && !roles.includes('SUPERADMIN')) {
      const schoolIds = await getUserSchoolIds(req.user!.userId);
      if (!event.schoolId || !schoolIds.includes(event.schoolId)) {
        throw new AppError(403, 'Akses ditolak');
      }
    }

    await prisma.event.delete({ where: { id: param(req.params.id) } });
    sendSuccess(res, null, 'Event berhasil dihapus');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/check-in', checkRole(Role.ANGGOTA), upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) throw new AppError(400, 'Foto check-in wajib diunggah');

    const eventId = param(req.params.id);
    const userId = req.user!.userId;
    const roles = req.user!.roles;
    const where = await buildEventVisibilityWhere(userId, roles);

    const event = await prisma.event.findFirst({
      where: { id: eventId, ...where },
    });
    if (!event) throw new AppError(404, 'Event tidak ditemukan');

    const now = new Date();
    if (now < event.startAt) throw new AppError(400, 'Check-in belum dibuka, event belum dimulai');
    if (now > event.endAt) throw new AppError(400, 'Event sudah berakhir');

    const membership = await resolveAnggotaGroup(userId, event.schoolId, event.targetLevels);
    const photoUrl = getPublicUrl(req.file.filename);

    const existing = await prisma.eventAttendance.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });

    if (existing?.status === EventCheckInStatus.PENDING || existing?.status === EventCheckInStatus.APPROVED) {
      throw new AppError(400, 'Anda sudah check-in event ini');
    }

    const attendance = existing
      ? await prisma.eventAttendance.update({
          where: { id: existing.id },
          data: {
            groupId: membership.group.id,
            photoUrl,
            status: EventCheckInStatus.PENDING,
            checkedAt: new Date(),
            approvedById: null,
            approvedAt: null,
            rejectionNote: null,
          },
          include: {
            event: { select: { id: true, title: true, pointValue: true } },
          },
        })
      : await prisma.eventAttendance.create({
          data: {
            eventId,
            userId,
            groupId: membership.group.id,
            photoUrl,
            status: EventCheckInStatus.PENDING,
          },
          include: {
            event: { select: { id: true, title: true, pointValue: true } },
          },
        });

    sendSuccess(res, attendance, 'Check-in terkirim, menunggu persetujuan pembina', 201);
  } catch (err) {
    next(err);
  }
});

export default router;
