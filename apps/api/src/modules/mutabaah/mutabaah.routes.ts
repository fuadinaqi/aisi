import { Router } from 'express';
import { mutabaahEntrySchema, mutabaahItemSchema, updateMutabaahItemSchema, POINT_RULES, isPointEligible } from '@dakwah/shared';
import { GroupLevel, Role } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  checkAuth,
  checkRole,
  validate,
  isPembinaOfGroup,
  canAccessSchool,
} from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { param } from '../../utils/param.js';
import { getMonday, assertWeekDateNotBeforeJoin } from '../../utils/weekDate.js';
import {
  emptyValueForItem,
  formatAnswerDisplay,
  validateAnswerValue,
} from './mutabaah.utils.js';

const router = Router();

router.use(checkAuth);

async function assertAnggotaOfGroup(userId: string, groupId: string) {
  const member = await prisma.groupMember.findFirst({
    where: { userId, groupId, isActive: true },
  });
  if (!member) throw new AppError(403, 'Anda bukan anggota kelompok ini');
  return member;
}

async function assertCanViewGroupMutabaah(viewerId: string, roles: string[], groupId: string) {
  const isAdmin = roles.includes('SUPERADMIN') || roles.includes('ADMIN');
  if (isAdmin) return;

  if (roles.includes('PEMBINA')) {
    const isOwner = await isPembinaOfGroup(viewerId, groupId);
    if (!isOwner) throw new AppError(403, 'Akses ditolak');
    return;
  }

  if (roles.includes('PJ_SEKOLAH')) {
    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { schoolId: true } });
    if (!group) throw new AppError(404, 'Kelompok tidak ditemukan');
    const allowed = await canAccessSchool(viewerId, roles, group.schoolId);
    if (!allowed) throw new AppError(403, 'Akses ditolak');
    return;
  }

  throw new AppError(403, 'Akses ditolak');
}

async function assertCanViewMemberMutabaah(
  viewerId: string,
  roles: string[],
  groupId: string,
  targetUserId: string,
) {
  const isAdmin = roles.includes('SUPERADMIN') || roles.includes('ADMIN');
  if (isAdmin) return;

  if (roles.includes('PEMBINA')) {
    const isOwner = await isPembinaOfGroup(viewerId, groupId);
    if (!isOwner) throw new AppError(403, 'Akses ditolak');
    return;
  }

  if (roles.includes('PJ_SEKOLAH')) {
    const group = await prisma.group.findUnique({ where: { id: groupId }, select: { schoolId: true } });
    if (!group) throw new AppError(404, 'Kelompok tidak ditemukan');
    const allowed = await canAccessSchool(viewerId, roles, group.schoolId);
    if (!allowed) throw new AppError(403, 'Akses ditolak');
    return;
  }

  if (viewerId === targetUserId) return;

  throw new AppError(403, 'Akses ditolak');
}

function serializeEntry(
  entry: {
    id: string;
    weekDate: Date;
    isSubmitted: boolean;
    submittedAt: Date | null;
    answers: {
      itemId: string;
      value: unknown;
      item: {
        id: string;
        title: string;
        description: string | null;
        target: string | null;
        fieldType: string;
        inputScope: string;
        options: unknown;
        minValue: number | null;
        maxValue: number | null;
        isRequired: boolean;
      };
    }[];
  } | null,
  items: {
    id: string;
    title: string;
    description: string | null;
    target: string | null;
    fieldType: string;
    inputScope: string;
    options: unknown;
    minValue: number | null;
    maxValue: number | null;
    isRequired: boolean;
    allowOther?: boolean;
    otherLabel?: string;
    sortOrder: number;
  }[],
) {
  const answerMap = new Map(entry?.answers.map((a) => [a.itemId, a.value]) ?? []);

  return {
    id: entry?.id ?? null,
    weekDate: entry?.weekDate ?? null,
    isSubmitted: entry?.isSubmitted ?? false,
    submittedAt: entry?.submittedAt ?? null,
    items: items.map((item) => {
      const value = answerMap.get(item.id) ?? emptyValueForItem(item as never);
      return {
        ...item,
        value,
        displayValue: formatAnswerDisplay(item as never, value),
      };
    }),
  };
}

async function saveMutabaahEntry(
  userId: string,
  groupId: string,
  weekDate: Date,
  answers: { itemId: string; value: unknown }[],
) {
  const member = await assertAnggotaOfGroup(userId, groupId);

  const normalizedWeek = getMonday(new Date(weekDate));
  try {
    assertWeekDateNotBeforeJoin(normalizedWeek, member.joinedAt);
  } catch {
    throw new AppError(400, 'Mutabaah hanya bisa diisi sejak pekan Anda bergabung ke kelompok ini');
  }

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { level: true } });
  if (!group) throw new AppError(404, 'Kelompok tidak ditemukan');

  const existing = await prisma.mutabaahEntry.findUnique({
    where: { userId_groupId_weekDate: { userId, groupId, weekDate: normalizedWeek } },
  });
  if (existing?.isSubmitted) throw new AppError(400, 'Mutabaah pekan ini sudah dikirim');

  const items = await prisma.mutabaahItem.findMany({
    where: { level: group.level, isActive: true },
  });
  const itemMap = new Map(items.map((i) => [i.id, i]));

  const validatedAnswers = answers.map((a) => {
    const item = itemMap.get(a.itemId);
    if (!item) throw new AppError(400, 'Poin mutabaah tidak valid');
    return { itemId: a.itemId, value: validateAnswerValue(item, a.value) };
  });

  for (const item of items.filter((i) => i.isRequired)) {
    if (!validatedAnswers.some((a) => a.itemId === item.id)) {
      throw new AppError(400, `"${item.title}" wajib diisi`);
    }
  }

  const entry = await prisma.$transaction(async (tx) => {
    const saved = await tx.mutabaahEntry.upsert({
      where: { userId_groupId_weekDate: { userId, groupId, weekDate: normalizedWeek } },
      create: { userId, groupId, weekDate: normalizedWeek },
      update: {},
    });

    await tx.mutabaahAnswer.deleteMany({ where: { entryId: saved.id } });
    if (validatedAnswers.length > 0) {
      await tx.mutabaahAnswer.createMany({
        data: validatedAnswers.map((a) => ({
          entryId: saved.id,
          itemId: a.itemId,
          value: a.value as object,
        })),
      });
    }

    return tx.mutabaahEntry.findUnique({
      where: { id: saved.id },
      include: {
        answers: {
          include: {
            item: {
              select: {
                id: true,
                title: true,
                description: true,
                target: true,
                fieldType: true,
                inputScope: true,
                options: true,
                minValue: true,
                maxValue: true,
                isRequired: true,
                allowOther: true,
                otherLabel: true,
              },
            },
          },
        },
      },
    });
  });

  return { entry, items, normalizedWeek };
}

router.get('/items', async (req, res, next) => {
  try {
    const { level } = req.query as { level?: GroupLevel };
    const roles = req.user!.roles;
    const isAdmin = roles.includes('SUPERADMIN') || roles.includes('ADMIN');

    const items = await prisma.mutabaahItem.findMany({
      where: {
        ...(level ? { level } : {}),
        ...(!isAdmin ? { isActive: true } : {}),
      },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { title: 'asc' }],
    });

    sendSuccess(res, items);
  } catch (err) {
    next(err);
  }
});

router.post('/items', checkRole(Role.SUPERADMIN, Role.ADMIN), validate(mutabaahItemSchema), async (req, res, next) => {
  try {
    const item = await prisma.mutabaahItem.create({ data: req.body });
    sendSuccess(res, item, 'Poin mutabaah berhasil ditambahkan', 201);
  } catch (err) {
    next(err);
  }
});

router.put(
  '/items/:id',
  checkRole(Role.SUPERADMIN, Role.ADMIN),
  validate(updateMutabaahItemSchema),
  async (req, res, next) => {
    try {
      const item = await prisma.mutabaahItem.update({
        where: { id: param(req.params.id) },
        data: req.body,
      });
      sendSuccess(res, item, 'Poin mutabaah berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/items/:id', checkRole(Role.SUPERADMIN, Role.ADMIN), async (req, res, next) => {
  try {
    const item = await prisma.mutabaahItem.update({
      where: { id: param(req.params.id) },
      data: { isActive: false },
    });
    sendSuccess(res, item, 'Poin mutabaah dinonaktifkan');
  } catch (err) {
    next(err);
  }
});

router.get('/my', checkRole(Role.ANGGOTA), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { weekDate, groupId: groupIdQuery } = req.query as { weekDate?: string; groupId?: string };

    let groupId = groupIdQuery;
    if (!groupId) {
      const memberships = await prisma.groupMember.findMany({
        where: { userId, isActive: true },
        include: { group: { select: { id: true, name: true, level: true } } },
      });
      if (memberships.length === 0) throw new AppError(404, 'Anda belum terdaftar di kelompok');
      if (memberships.length > 1) {
        sendSuccess(res, {
          needsGroupSelection: true,
          groups: memberships.map((m) => ({
            ...m.group,
            joinedAt: m.joinedAt,
            minWeekDate: getMonday(m.joinedAt),
          })),
        });
        return;
      }
      groupId = memberships[0].groupId;
    }

    const member = await assertAnggotaOfGroup(userId, groupId);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, level: true },
    });
    if (!group) throw new AppError(404, 'Kelompok tidak ditemukan');

    const normalizedWeek = weekDate ? getMonday(new Date(weekDate)) : getMonday(new Date());

    const [items, entry] = await Promise.all([
      prisma.mutabaahItem.findMany({
        where: { level: group.level, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      }),
      prisma.mutabaahEntry.findUnique({
        where: { userId_groupId_weekDate: { userId, groupId, weekDate: normalizedWeek } },
        include: {
          answers: {
            include: {
              item: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  target: true,
                  fieldType: true,
                  inputScope: true,
                  options: true,
                  minValue: true,
                  maxValue: true,
                  isRequired: true,
                  allowOther: true,
                  otherLabel: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const serialized = serializeEntry(entry, items);

    sendSuccess(res, {
      group,
      weekDate: normalizedWeek,
      minWeekDate: getMonday(member.joinedAt),
      joinedAt: member.joinedAt,
      id: serialized.id,
      isSubmitted: serialized.isSubmitted,
      submittedAt: serialized.submittedAt,
      items: serialized.items,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/my', checkRole(Role.ANGGOTA), validate(mutabaahEntrySchema), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { groupId, weekDate, answers } = req.body;
    const { entry, items } = await saveMutabaahEntry(userId, groupId, weekDate, answers);
    sendSuccess(res, serializeEntry(entry, items), 'Mutabaah berhasil disimpan');
  } catch (err) {
    next(err);
  }
});

router.post('/my/submit', checkRole(Role.ANGGOTA), validate(mutabaahEntrySchema), async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const { groupId, weekDate, answers } = req.body;
    const { entry, items, normalizedWeek } = await saveMutabaahEntry(userId, groupId, weekDate, answers);

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.mutabaahEntry.update({
        where: { id: entry!.id },
        data: { isSubmitted: true, submittedAt: new Date() },
        include: {
          answers: {
            include: {
              item: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  target: true,
                  fieldType: true,
                  inputScope: true,
                  options: true,
                  minValue: true,
                  maxValue: true,
                  isRequired: true,
                  allowOther: true,
                  otherLabel: true,
                },
              },
            },
          },
        },
      });

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { roles: { select: { role: true } } },
      });
      const eligible = user && isPointEligible(user.roles.map((r) => r.role));

      if (eligible) {
        const existingPoint = await tx.pointLog.findFirst({
          where: { userId, refType: 'MUTABAAH', refId: saved.id },
        });
        if (!existingPoint) {
          await tx.pointLog.create({
            data: {
              userId,
              points: POINT_RULES.ANGGOTA_SUBMIT_MUTABAAH,
              description: 'Mengirim mutabaah yaumiyah',
              refType: 'MUTABAAH',
              refId: saved.id,
            },
          });
          await tx.user.update({
            where: { id: userId },
            data: { totalPoints: { increment: POINT_RULES.ANGGOTA_SUBMIT_MUTABAAH } },
          });
        }
      }

      return saved;
    });

    sendSuccess(res, { ...serializeEntry(updated, items), weekDate: normalizedWeek }, 'Mutabaah berhasil dikirim');
  } catch (err) {
    next(err);
  }
});

router.get('/member/:userId', async (req, res, next) => {
  try {
    const viewerId = req.user!.userId;
    const roles = req.user!.roles;
    const targetUserId = param(req.params.userId);
    const { groupId, weekDate } = req.query as { groupId?: string; weekDate?: string };

    if (!groupId) throw new AppError(400, 'groupId wajib diisi');
    await assertCanViewMemberMutabaah(viewerId, roles, groupId, targetUserId);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, level: true },
    });
    if (!group) throw new AppError(404, 'Kelompok tidak ditemukan');

    const normalizedWeek = weekDate ? getMonday(new Date(weekDate)) : getMonday(new Date());

    const [items, entry, user] = await Promise.all([
      prisma.mutabaahItem.findMany({
        where: { level: group.level, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      }),
      prisma.mutabaahEntry.findUnique({
        where: {
          userId_groupId_weekDate: { userId: targetUserId, groupId, weekDate: normalizedWeek },
        },
        include: {
          answers: {
            include: {
              item: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  target: true,
                  fieldType: true,
                  inputScope: true,
                  options: true,
                  minValue: true,
                  maxValue: true,
                  isRequired: true,
                  allowOther: true,
                  otherLabel: true,
                },
              },
            },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, name: true },
      }),
    ]);

    if (!user) throw new AppError(404, 'Anggota tidak ditemukan');

    const serialized = serializeEntry(entry, items);

    sendSuccess(res, {
      user,
      group,
      weekDate: normalizedWeek,
      id: serialized.id,
      isSubmitted: serialized.isSubmitted,
      submittedAt: serialized.submittedAt,
      items: serialized.items,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/group/:groupId', async (req, res, next) => {
  try {
    const viewerId = req.user!.userId;
    const roles = req.user!.roles;
    const groupId = param(req.params.groupId);
    const { weekDate } = req.query as { weekDate?: string };

    await assertCanViewGroupMutabaah(viewerId, roles, groupId);

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, level: true },
    });
    if (!group) throw new AppError(404, 'Kelompok tidak ditemukan');

    const normalizedWeek = weekDate ? getMonday(new Date(weekDate)) : getMonday(new Date());

    const [members, entries, items] = await Promise.all([
      prisma.groupMember.findMany({
        where: { groupId, isActive: true },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { user: { name: 'asc' } },
      }),
      prisma.mutabaahEntry.findMany({
        where: { groupId, weekDate: normalizedWeek },
        include: {
          answers: {
            include: {
              item: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  target: true,
                  fieldType: true,
                  inputScope: true,
                  options: true,
                  minValue: true,
                  maxValue: true,
                  isRequired: true,
                  allowOther: true,
                  otherLabel: true,
                },
              },
            },
          },
        },
      }),
      prisma.mutabaahItem.findMany({
        where: { level: group.level, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      }),
    ]);

    const entryMap = new Map(entries.map((e) => [e.userId, e]));

    sendSuccess(res, {
      group,
      weekDate: normalizedWeek,
      members: members.map((m) => ({
        user: m.user,
        ...serializeEntry(entryMap.get(m.user.id) ?? null, items),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
