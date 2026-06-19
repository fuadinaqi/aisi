import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env.js';
import { prisma } from './prisma.js';

export interface JwtPayload {
  userId: string;
  email: string;
  roles: string[];
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions['expiresIn'] });
}

export async function signRefreshToken(userId: string): Promise<string> {
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.refreshToken.create({
    data: { userId, token, expiresAt },
  });

  return jwt.sign({ token }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string; tokenId: string }> {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { token: string };
  const stored = await prisma.refreshToken.findUnique({ where: { token: decoded.token } });
  if (!stored || stored.expiresAt < new Date()) {
    throw new Error('Invalid refresh token');
  }
  return { userId: stored.userId, tokenId: stored.token };
}

export async function rotateRefreshToken(oldTokenId: string, userId: string): Promise<string> {
  await prisma.refreshToken.delete({ where: { token: oldTokenId } });
  return signRefreshToken(userId);
}

export async function revokeRefreshToken(token: string): Promise<void> {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { token: string };
    await prisma.refreshToken.deleteMany({ where: { token: decoded.token } });
  } catch {
    // ignore invalid tokens on logout
  }
}
