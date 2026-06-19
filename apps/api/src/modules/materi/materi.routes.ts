import { Router } from 'express';
import { param } from '../../utils/param.js';
import { materiSchema, paginationSchema } from '@dakwah/shared';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, checkRole, validate } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../utils/AppError.js';
import { uploadMateri, getPublicUrl } from '../../lib/storage.js';
import { Role, MateriContentType } from '@prisma/client';
import { getMonday } from '../../utils/weekDate.js';

const router = Router();

router.use(checkAuth);

function parseMateriBody(body: Record<string, unknown>, fileUrls: string[] = []) {
  return materiSchema.parse({
    title: body.title,
    description: body.description || undefined,
    weekDate: body.weekDate,
    contentType: body.contentType,
    linkUrl: body.linkUrl || undefined,
    contentHtml: body.contentHtml || undefined,
    fileUrls,
    isPublished: body.isPublished === undefined ? true : body.isPublished === true || body.isPublished === 'true',
  });
}

router.get('/', validate(paginationSchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const { weekDate } = req.query as { weekDate?: string };
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { isPublished: true };
    if (weekDate) where.weekDate = getMonday(new Date(weekDate));

    const [materi, total] = await Promise.all([
      prisma.weeklyMateri.findMany({
        where,
        skip,
        take: limit,
        orderBy: { weekDate: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          weekDate: true,
          contentType: true,
          linkUrl: true,
          fileUrls: true,
          createdAt: true,
        },
      }),
      prisma.weeklyMateri.count({ where }),
    ]);
    sendSuccess(res, materi, undefined, 200, { page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const materi = await prisma.weeklyMateri.findFirst({
      where: { id: param(req.params.id), isPublished: true },
    });
    if (!materi) throw new AppError(404, 'Materi tidak ditemukan');
    sendSuccess(res, materi);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  checkRole(Role.ADMIN, Role.SUPERADMIN),
  uploadMateri.array('files', 5),
  async (req, res, next) => {
    try {
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      const fileUrls = files.map((f) => getPublicUrl(f.filename));
      const parsed = parseMateriBody(req.body as Record<string, unknown>, fileUrls);

      const materi = await prisma.weeklyMateri.create({
        data: {
          title: parsed.title,
          description: parsed.description,
          weekDate: getMonday(new Date(parsed.weekDate)),
          contentType: parsed.contentType as MateriContentType,
          linkUrl: parsed.contentType === 'LINK' ? parsed.linkUrl : null,
          contentHtml: parsed.contentType === 'RICH_TEXT' ? parsed.contentHtml : null,
          fileUrls: parsed.contentType === 'FILE' ? parsed.fileUrls : [],
          isPublished: parsed.isPublished,
          createdById: req.user!.userId,
        },
      });

      sendSuccess(res, materi, 'Materi berhasil dibuat', 201);
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/:id',
  checkRole(Role.ADMIN, Role.SUPERADMIN),
  uploadMateri.array('files', 5),
  async (req, res, next) => {
    try {
      const existing = await prisma.weeklyMateri.findUnique({ where: { id: param(req.params.id) } });
      if (!existing) throw new AppError(404, 'Materi tidak ditemukan');

      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      const uploadedUrls = files.map((f) => getPublicUrl(f.filename));
      const body = req.body as Record<string, unknown>;

      const keepFiles = typeof body.keepFileUrls === 'string'
        ? JSON.parse(body.keepFileUrls)
        : Array.isArray(body.keepFileUrls)
          ? body.keepFileUrls
          : existing.fileUrls;

      const fileUrls = [...(keepFiles as string[]), ...uploadedUrls];
      const parsed = parseMateriBody(body, fileUrls);

      const materi = await prisma.weeklyMateri.update({
        where: { id: param(req.params.id) },
        data: {
          title: parsed.title,
          description: parsed.description,
          weekDate: getMonday(new Date(parsed.weekDate)),
          contentType: parsed.contentType as MateriContentType,
          linkUrl: parsed.contentType === 'LINK' ? parsed.linkUrl : null,
          contentHtml: parsed.contentType === 'RICH_TEXT' ? parsed.contentHtml : null,
          fileUrls: parsed.contentType === 'FILE' ? parsed.fileUrls : [],
          isPublished: parsed.isPublished,
        },
      });

      sendSuccess(res, materi, 'Materi berhasil diperbarui');
    } catch (err) {
      next(err);
    }
  },
);

router.delete('/:id', checkRole(Role.ADMIN, Role.SUPERADMIN), async (req, res, next) => {
  try {
    await prisma.weeklyMateri.delete({ where: { id: param(req.params.id) } });
    sendSuccess(res, null, 'Materi berhasil dihapus');
  } catch (err) {
    next(err);
  }
});

export default router;
