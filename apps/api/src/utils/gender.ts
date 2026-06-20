import { Gender } from '@prisma/client';
import { AppError } from './AppError.js';

export function getGenderLabel(gender: Gender | string): string {
  return gender === 'AKHWAT' ? 'Akhwat' : 'Ikhwan';
}

export function assertGenderMatch(
  userGender: Gender | null | undefined,
  expected: Gender,
  label = 'User',
) {
  if (userGender !== expected) {
    throw new AppError(
      400,
      `${label} harus ${getGenderLabel(expected)} agar sesuai dengan kelompok`,
    );
  }
}
