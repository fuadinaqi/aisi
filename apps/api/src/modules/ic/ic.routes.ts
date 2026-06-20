import { Router } from 'express';
import {
  indikatorCapaianSchema,
  updateIndikatorCapaianSchema,
  memberICProgressSchema,
  IC_CATEGORY_LABELS,
  IC_TYPE_LABELS,
  IC_CATEGORIES,
  IC_TYPES,
} from '@dakwah/shared';
import { GroupLevel, ICCategory, ICType, Role } from '@prisma/client';
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

const router = Router();

router.use(checkAuth);

function assertCanViewICMaster(roles: string[]) {
  const allowed = ['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH', 'PEMBINA'];
  if (!roles.some((r) => allowed.includes(r))) {
    throw new AppError(403, 'Akses ditolak');
  }
}

async function assertCanViewMemberIC(
  viewerId: string,
  roles: string[],
  groupId: string,
  _targetUserId: string,
) {
  if (roles.includes('SUPERADMIN') || roles.includes('ADMIN')) return;

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

async function assertCanCheckMemberIC(pembinaId: string, groupId: string) {
  const isOwner = await isPembinaOfGroup(pembinaId, groupId);
  if (!isOwner) throw new AppError(403, 'Hanya pembina kelompok yang dapat mengubah checklist IC');
}

function buildMemberICResponse(
  user: { id: string; name: string },
  group: { id: string; name: string; level: GroupLevel },
  items: {
    id: string;
    category: ICCategory;
    type: ICType;
    number: number;
    title: string;
    materi: string | null;
    sortOrder: number;
  }[],
  progressMap: Map<
    string,
    { isAchieved: boolean; checkedAt: Date; checkedByName: string | null }
  >,
) {
  let total = 0;
  let achieved = 0;
  let primerTotal = 0;
  let primerAchieved = 0;
  let sekunderTotal = 0;
  let sekunderAchieved = 0;

  const categories = IC_CATEGORIES.map((category) => {
    const types = IC_TYPES.map((type) => {
      const categoryItems = items
        .filter((item) => item.category === category && item.type === type)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.number - b.number)
        .map((item) => {
          const progress = progressMap.get(item.id);
          const isAchieved = progress?.isAchieved ?? false;

          total += 1;
          if (isAchieved) achieved += 1;
          if (type === 'PRIMER') {
            primerTotal += 1;
            if (isAchieved) primerAchieved += 1;
          } else {
            sekunderTotal += 1;
            if (isAchieved) sekunderAchieved += 1;
          }

          return {
            id: item.id,
            number: item.number,
            title: item.title,
            materi: item.materi,
            sortOrder: item.sortOrder,
            isAchieved,
            checkedAt: progress?.checkedAt ?? null,
            checkedByName: progress?.checkedByName ?? null,
          };
        });

      return {
        type,
        label: IC_TYPE_LABELS[type],
        items: categoryItems,
      };
    }).filter((t) => t.items.length > 0);

    return {
      category,
      label: IC_CATEGORY_LABELS[category],
      types,
    };
  }).filter((c) => c.types.length > 0);

  return {
    user,
    group,
    summary: {
      total,
      achieved,
      primerTotal,
      primerAchieved,
      sekunderTotal,
      sekunderAchieved,
    },
    categories,
  };
}

router.get('/items', async (req, res, next) => {
  try {
    const roles = req.user!.roles;
    assertCanViewICMaster(roles);

    const { level, category, type } = req.query as {
      level?: GroupLevel;
      category?: ICCategory;
      type?: ICType;
    };
    const isAdmin = roles.includes('SUPERADMIN') || roles.includes('ADMIN');

    const items = await prisma.indikatorCapaian.findMany({
      where: {
        ...(level ? { level } : {}),
        ...(category ? { category } : {}),
        ...(type ? { type } : {}),
        ...(!isAdmin ? { isActive: true } : {}),
      },
      orderBy: [
        { level: 'asc' },
        { category: 'asc' },
        { type: 'asc' },
        { sortOrder: 'asc' },
        { number: 'asc' },
      ],
    });

    sendSuccess(res, items);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/items',
  checkRole(Role.SUPERADMIN, Role.ADMIN),
  validate(indikatorCapaianSchema),
  async (req, res, next) => {
    try {
      const item = await prisma.indikatorCapaian.create({ data: req.body });
      sendSuccess(res, item, 'Indikator capaian berhasil ditambahkan', 201);
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/items/:id',
  checkRole(Role.SUPERADMIN, Role.ADMIN),
  validate(updateIndikatorCapaianSchema),
  async (req, res, next) => {
    try {
      const item = await prisma.indikatorCapaian.update({
        where: { id: param(req.params.id) },
        data: req.body,
      });
      sendSuccess(res, item, 'Indikator capaian berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/items/:id', checkRole(Role.SUPERADMIN, Role.ADMIN), async (req, res, next) => {
  try {
    const item = await prisma.indikatorCapaian.update({
      where: { id: param(req.params.id) },
      data: { isActive: false },
    });
    sendSuccess(res, item, 'Indikator capaian dinonaktifkan');
  } catch (err) {
    next(err);
  }
});

router.get('/member/:userId', async (req, res, next) => {
  try {
    const viewerId = req.user!.userId;
    const roles = req.user!.roles;
    const targetUserId = param(req.params.userId);
    const { groupId } = req.query as { groupId?: string };

    if (!groupId) throw new AppError(400, 'groupId wajib diisi');
    await assertCanViewMemberIC(viewerId, roles, groupId, targetUserId);

    const member = await prisma.groupMember.findFirst({
      where: { groupId, userId: targetUserId, isActive: true },
    });
    if (!member) throw new AppError(404, 'Anggota tidak ditemukan di kelompok ini');

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, level: true },
    });
    if (!group) throw new AppError(404, 'Kelompok tidak ditemukan');

    const [items, progressRows, user] = await Promise.all([
      prisma.indikatorCapaian.findMany({
        where: { level: group.level, isActive: true },
        orderBy: [{ category: 'asc' }, { type: 'asc' }, { sortOrder: 'asc' }, { number: 'asc' }],
      }),
      prisma.memberICProgress.findMany({
        where: { userId: targetUserId, groupId },
        include: { checkedBy: { select: { name: true } } },
      }),
      prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, name: true },
      }),
    ]);

    if (!user) throw new AppError(404, 'Anggota tidak ditemukan');

    const progressMap = new Map(
      progressRows.map((p) => [
        p.indikatorId,
        {
          isAchieved: p.isAchieved,
          checkedAt: p.checkedAt,
          checkedByName: p.checkedBy.name,
        },
      ]),
    );

    sendSuccess(res, buildMemberICResponse(user, group, items, progressMap));
  } catch (err) {
    next(err);
  }
});

router.put(
  '/member/:userId/progress',
  checkRole(Role.PEMBINA),
  validate(memberICProgressSchema),
  async (req, res, next) => {
    try {
      const pembinaId = req.user!.userId;
      const targetUserId = param(req.params.userId);
      const { groupId, indikatorId, isAchieved } = req.body as {
        groupId: string;
        indikatorId: string;
        isAchieved: boolean;
      };

      await assertCanCheckMemberIC(pembinaId, groupId);

      const member = await prisma.groupMember.findFirst({
        where: { groupId, userId: targetUserId, isActive: true },
      });
      if (!member) throw new AppError(404, 'Anggota tidak ditemukan di kelompok ini');

      const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: { level: true },
      });
      if (!group) throw new AppError(404, 'Kelompok tidak ditemukan');

      const indikator = await prisma.indikatorCapaian.findFirst({
        where: { id: indikatorId, level: group.level, isActive: true },
      });
      if (!indikator) throw new AppError(404, 'Indikator capaian tidak ditemukan');

      const progress = await prisma.memberICProgress.upsert({
        where: {
          userId_groupId_indikatorId: { userId: targetUserId, groupId, indikatorId },
        },
        update: {
          isAchieved,
          checkedById: pembinaId,
          checkedAt: new Date(),
        },
        create: {
          userId: targetUserId,
          groupId,
          indikatorId,
          isAchieved,
          checkedById: pembinaId,
        },
        include: { checkedBy: { select: { name: true } } },
      });

      sendSuccess(res, {
        indikatorId: progress.indikatorId,
        isAchieved: progress.isAchieved,
        checkedAt: progress.checkedAt,
        checkedByName: progress.checkedBy.name,
      }, isAchieved ? 'IC ditandai tercapai' : 'IC ditandai belum tercapai');
    } catch (err) {
      next(err);
    }
  },
);

export default router;
