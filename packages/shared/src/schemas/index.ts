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

export const evaluationListQuerySchema = paginationSchema.extend({
  groupId: z.string().optional(),
  weekDate: z.string().optional(),
  schoolId: z.string().optional(),
});

export const schoolSchema = z.object({
  name: z.string().min(2),
  city: z.string().default('Depok'),
  isActive: z.boolean().default(true),
});

export const createSchoolWithPjSchema = z.object({
  name: z.string().min(2, 'Nama sekolah minimal 2 karakter'),
  city: z.string().default('Depok'),
  pj: z.object({
    name: z.string().min(2, 'Nama PJ minimal 2 karakter'),
    email: z.string().email('Email PJ tidak valid'),
    phone: z.string().optional(),
    password: passwordSchema.optional(),
  }),
});

export const invitePjSchema = z.object({
  name: z.string().min(2, 'Nama PJ minimal 2 karakter'),
  email: z.string().email('Email PJ tidak valid'),
  phone: z.string().optional(),
  password: passwordSchema.optional(),
  replace: z.boolean().default(false),
  replaceUserId: z.string().optional(),
});

export const inviteAnggotaSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
});

export const updateGroupMemberSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').optional(),
  email: z.string().email('Email tidak valid').optional(),
  phone: z.string().optional().nullable(),
});

const pembinaInputSchema = z.object({
  name: z.string().min(2, 'Nama pembina minimal 2 karakter'),
  email: z.string().email('Email pembina tidak valid'),
  phone: z.string().optional(),
  password: passwordSchema.optional(),
});

export const createSchoolGroupSchema = z
  .object({
    name: z.string().min(2, 'Nama kelompok minimal 2 karakter'),
    level: z.enum(['LEVEL_1', 'LEVEL_2']),
    pembinaId: z.string().optional(),
    pembina: pembinaInputSchema.optional(),
  })
  .refine((data) => data.pembinaId || data.pembina, {
    message: 'Pilih pembina atau undang pembina baru',
    path: ['pembinaId'],
  });

export const groupSchema = z.object({
  name: z.string().min(2),
  level: z.enum(['LEVEL_1', 'LEVEL_2']),
  schoolId: z.string(),
  pembinaId: z.string(),
});

export const updateGroupSchema = z.object({
  name: z.string().min(2, 'Nama kelompok minimal 2 karakter').optional(),
  level: z.enum(['LEVEL_1', 'LEVEL_2']).optional(),
  pembinaId: z.string().optional(),
  isActive: z.boolean().optional(),
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

export const eventSchema = z
  .object({
    title: z.string().min(2, 'Judul minimal 2 karakter'),
    description: z.string().optional(),
    location: z.string().optional(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    pointValue: z.number().int().min(0).default(0),
    imageUrl: z.string().optional(),
    schoolId: z.string().nullable().optional(),
    targetLevels: z.array(z.enum(['LEVEL_1', 'LEVEL_2'])).default([]),
    isPublished: z.boolean().default(true),
  })
  .refine((data) => data.endAt > data.startAt, {
    message: 'Waktu berakhir harus setelah waktu mulai',
    path: ['endAt'],
  });

export const rejectEventCheckInSchema = z.object({
  rejectionNote: z.string().optional(),
});

export const materiSchema = z
  .object({
    title: z.string().min(2, 'Judul minimal 2 karakter'),
    description: z.string().optional(),
    weekDate: z.coerce.date(),
    contentType: z.enum(['FILE', 'LINK', 'RICH_TEXT']),
    linkUrl: z.string().url('Link tidak valid').optional(),
    contentHtml: z.string().optional(),
    fileUrls: z.array(z.string()).default([]),
    isPublished: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.contentType === 'LINK' && !data.linkUrl) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Link wajib diisi', path: ['linkUrl'] });
    }
    if (data.contentType === 'RICH_TEXT' && !data.contentHtml?.replace(/<[^>]*>/g, '').trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Konten wajib diisi', path: ['contentHtml'] });
    }
    if (data.contentType === 'FILE' && data.fileUrls.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'File wajib diunggah', path: ['fileUrls'] });
    }
  });

export const groupLevelConfigSchema = z.object({
  level: z.enum(['LEVEL_1', 'LEVEL_2']),
  label: z.string().min(1),
});

const mutabaahOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

const mutabaahItemObjectSchema = z.object({
  level: z.enum(['LEVEL_1', 'LEVEL_2']),
  title: z.string().min(2, 'Judul minimal 2 karakter'),
  description: z.string().optional(),
  target: z.string().optional(),
  fieldType: z.enum(['CHECKBOX', 'NUMBER', 'TEXT', 'SELECT']),
  inputScope: z.enum(['WEEKLY', 'DAILY']).default('WEEKLY'),
  options: z.array(mutabaahOptionSchema).optional(),
  minValue: z.number().int().optional(),
  maxValue: z.number().int().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isRequired: z.boolean().default(true),
  isActive: z.boolean().default(true),
  allowOther: z.boolean().default(false),
  otherLabel: z.string().min(1).default('Lainnya'),
});

function refineMutabaahItem(
  data: z.infer<typeof mutabaahItemObjectSchema>,
  ctx: z.RefinementCtx,
) {
  if (data.fieldType === 'SELECT' && (!data.options || data.options.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Pilihan wajib diisi untuk tipe SELECT',
      path: ['options'],
    });
  }
  if (data.minValue !== undefined && data.maxValue !== undefined && data.minValue > data.maxValue) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Nilai minimum tidak boleh lebih besar dari maksimum',
      path: ['minValue'],
    });
  }
}

export const mutabaahItemSchema = mutabaahItemObjectSchema.superRefine(refineMutabaahItem);

export const updateMutabaahItemSchema = mutabaahItemObjectSchema
  .partial()
  .superRefine((data, ctx) => {
    if (data.fieldType === 'SELECT' && (!data.options || data.options.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Pilihan wajib diisi untuk tipe SELECT',
        path: ['options'],
      });
    }
    if (data.minValue !== undefined && data.maxValue !== undefined && data.minValue > data.maxValue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nilai minimum tidak boleh lebih besar dari maksimum',
        path: ['minValue'],
      });
    }
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Minimal satu field harus diisi',
  });

export const mutabaahEntrySchema = z.object({
  groupId: z.string(),
  weekDate: z.coerce.date(),
  answers: z.array(
    z.object({
      itemId: z.string(),
      value: z.record(z.unknown()),
    }),
  ),
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
export type CreateSchoolWithPjInput = z.infer<typeof createSchoolWithPjSchema>;
export type CreateSchoolGroupInput = z.infer<typeof createSchoolGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type UpdateGroupMemberInput = z.infer<typeof updateGroupMemberSchema>;
