import { Router } from 'express';
import { groupLevelConfigSchema } from '@dakwah/shared';
import { prisma } from '../../lib/prisma.js';
import { checkAuth, checkRole, validate } from '../../middleware/auth.js';
import { sendSuccess } from '../../utils/response.js';
import { Role } from '@prisma/client';

const router = Router();

router.get('/group-levels', async (_req, res, next) => {
  try {
    const configs = await prisma.groupLevelConfig.findMany({ orderBy: { level: 'asc' } });
    sendSuccess(res, configs);
  } catch (err) {
    next(err);
  }
});

router.put('/group-levels', checkAuth, checkRole(Role.SUPERADMIN, Role.ADMIN), validate(groupLevelConfigSchema), async (req, res, next) => {
  try {
    const { level, label } = req.body;
    const config = await prisma.groupLevelConfig.upsert({
      where: { level },
      update: { label },
      create: { level, label },
    });
    sendSuccess(res, config, 'Label level berhasil diperbarui');
  } catch (err) {
    next(err);
  }
});

export default router;
