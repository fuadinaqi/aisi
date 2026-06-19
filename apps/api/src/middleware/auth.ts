import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { verifyAccessToken, JwtPayload } from '../lib/jwt.js';
import { AppError } from '../utils/AppError.js';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function checkAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'Token tidak ditemukan');
    }
    const token = authHeader.slice(7);
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new AppError(401, 'Token tidak valid atau expired'));
  }
}

export function checkRole(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const hasRole = req.user.roles.some((r) => allowedRoles.includes(r as Role));
    if (!hasRole) return next(new AppError(403, 'Akses ditolak'));
    next();
  };
}

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const message = err.errors.map((e) => e.message).join(', ');
        next(new AppError(400, message));
      } else {
        next(new AppError(400, 'Validasi gagal'));
      }
    }
  };
}

export async function getUserSchoolIds(userId: string): Promise<string[]> {
  const schools = await prisma.userSchool.findMany({ where: { userId }, select: { schoolId: true } });
  return schools.map((s) => s.schoolId);
}

export async function isPembinaOfGroup(userId: string, groupId: string): Promise<boolean> {
  const group = await prisma.group.findFirst({ where: { id: groupId, pembinaId: userId } });
  return !!group;
}

export async function canAccessSchool(userId: string, roles: string[], schoolId: string): Promise<boolean> {
  if (roles.includes('SUPERADMIN') || roles.includes('ADMIN')) return true;
  const schoolIds = await getUserSchoolIds(userId);
  return schoolIds.includes(schoolId);
}
