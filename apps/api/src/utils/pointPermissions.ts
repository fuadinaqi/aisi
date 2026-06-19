import { canGrantManualPoints, getPointEligibleTargetRole } from '@dakwah/shared';
import { prisma } from '../lib/prisma.js';
import { getUserSchoolIds } from '../middleware/auth.js';

export async function assertCanGrantManualPoints(
  grantorId: string,
  grantorRoles: string[],
  targetUserId: string,
  targetRoles: string[],
): Promise<void> {
  if (grantorId === targetUserId) {
    throw new Error('SELF_ADD');
  }

  if (!canGrantManualPoints(grantorRoles, targetRoles)) {
    throw new Error('ROLE_DENIED');
  }

  const targetRole = getPointEligibleTargetRole(targetRoles);
  if (!targetRole) {
    throw new Error('NOT_ELIGIBLE');
  }

  if (grantorRoles.includes('SUPERADMIN') || grantorRoles.includes('ADMIN')) {
    return;
  }

  if (grantorRoles.includes('PJ_SEKOLAH')) {
    const schoolIds = await getUserSchoolIds(grantorId);
    if (targetRole === 'PEMBINA') {
      const count = await prisma.group.count({
        where: { pembinaId: targetUserId, schoolId: { in: schoolIds } },
      });
      if (count === 0) throw new Error('SCOPE_DENIED');
      return;
    }

    const count = await prisma.groupMember.count({
      where: { userId: targetUserId, group: { schoolId: { in: schoolIds } } },
    });
    if (count === 0) throw new Error('SCOPE_DENIED');
    return;
  }

  if (grantorRoles.includes('PEMBINA')) {
    if (targetRole !== 'ANGGOTA') throw new Error('ROLE_DENIED');
    const count = await prisma.groupMember.count({
      where: { userId: targetUserId, group: { pembinaId: grantorId } },
    });
    if (count === 0) throw new Error('SCOPE_DENIED');
    return;
  }

  throw new Error('ROLE_DENIED');
}
