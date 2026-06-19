import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .regex(/[A-Z]/, 'Password harus mengandung minimal 1 huruf besar')
  .regex(/[0-9]/, 'Password harus mengandung minimal 1 angka');

export const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const setPasswordSchema = z
  .object({
    token: z.string().uuid('Token tidak valid'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirmPassword'],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirmPassword'],
  });

export const invitationSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
  role: z.enum(['SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH', 'PEMBINA', 'ANGGOTA']),
  schoolId: z.string().optional(),
  groupId: z.string().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const schoolSchema = z.object({
  name: z.string().min(2),
  city: z.string().default('Depok'),
  isActive: z.boolean().default(true),
});

export const groupSchema = z.object({
  name: z.string().min(2),
  level: z.enum(['LEVEL_1', 'LEVEL_2']),
  schoolId: z.string(),
  pembinaId: z.string(),
});

export const evaluationSchema = z.object({
  groupId: z.string(),
  weekDate: z.coerce.date(),
  notes: z.string().optional(),
  attendances: z.array(
    z.object({
      userId: z.string(),
      status: z.enum(['HADIR', 'TIDAK_HADIR', 'IZIN', 'SAKIT']),
      note: z.string().optional(),
    }),
  ),
});

export const eventSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  location: z.string().optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional(),
  pointValue: z.number().int().min(0).default(0),
  imageUrl: z.string().optional(),
  isPublished: z.boolean().default(false),
});

export const materiSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  weekDate: z.coerce.date(),
  fileUrls: z.array(z.string()).default([]),
  isPublished: z.boolean().default(true),
});

export const groupLevelConfigSchema = z.object({
  level: z.enum(['LEVEL_1', 'LEVEL_2']),
  label: z.string().min(1),
});

export const manualPointSchema = z.object({
  userId: z.string(),
  points: z.number().int(),
  description: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;
export type InvitationInput = z.infer<typeof invitationSchema>;
export type EvaluationInput = z.infer<typeof evaluationSchema>;
