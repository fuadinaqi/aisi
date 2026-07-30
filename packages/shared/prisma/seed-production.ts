/**
 * Seed production (bootstrap) — data penting saja, idempotent, tidak wipe DB.
 *
 * Isi:
 * - label level Muda / Pratama
 * - master mutabaah (jika belum ada)
 * - master indikator capaian (upsert)
 * - daftar sekolah (create yang belum ada)
 * - 1 user SUPERADMIN (hanya jika belum ada superadmin)
 *
 * Tidak membuat: admin/PJ/pembina/anggota dummy, kelompok, event, evaluasi, undangan.
 *
 * Usage:
 *   SEED_SUPERADMIN_EMAIL=... SEED_PASSWORD_SUPERADMIN=... pnpm db:seed:prod
 */
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, Role, GroupLevel, Gender } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { IC_SEED_DATA } from './ic-seed-data.js';
import { SCHOOLS_DEPOK } from '../src/constants/index.js';

const seedDir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(seedDir, '../.env') });
loadEnv({ path: path.resolve(seedDir, '../../../apps/api-go/.env') });

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL tidak ditemukan. Isi packages/shared/.env atau apps/api-go/.env.',
  );
}

const email = (process.env.SEED_SUPERADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.SEED_PASSWORD_SUPERADMIN || '';
const name = (process.env.SEED_SUPERADMIN_NAME || 'Super Admin').trim();

if (!email || !email.includes('@')) {
  throw new Error('SEED_SUPERADMIN_EMAIL wajib di-set (email valid).');
}
if (password.length < 12) {
  throw new Error('SEED_PASSWORD_SUPERADMIN wajib di-set (minimal 12 karakter).');
}

const prisma = new PrismaClient();

const MUTABAAH_ITEMS = [
  {
    level: GroupLevel.LEVEL_1,
    title: 'Sholat Wajib (berjamaah di masjid bagi laki laki)',
    target: '35x',
    fieldType: 'NUMBER' as const,
    inputScope: 'WEEKLY' as const,
    minValue: 0,
    maxValue: 35,
    isRequired: true,
    sortOrder: 1,
  },
  {
    level: GroupLevel.LEVEL_1,
    title: "Tilawah Al Qur'an",
    target: '14 halaman',
    fieldType: 'NUMBER' as const,
    inputScope: 'WEEKLY' as const,
    minValue: 0,
    maxValue: 50,
    isRequired: false,
    sortOrder: 2,
  },
  {
    level: GroupLevel.LEVEL_1,
    title: 'Dzikir pagi petang',
    description: 'Total dzikir pagi petang pekan ini (angka)',
    target: '5x seminggu',
    fieldType: 'NUMBER' as const,
    inputScope: 'WEEKLY' as const,
    minValue: 0,
    maxValue: 5,
    isRequired: false,
    sortOrder: 3,
  },
  {
    level: GroupLevel.LEVEL_2,
    title: 'Sholat Wajib (berjamaah di masjid bagi laki laki)',
    target: '35x seminggu',
    fieldType: 'NUMBER' as const,
    inputScope: 'WEEKLY' as const,
    minValue: 0,
    maxValue: 35,
    isRequired: true,
    sortOrder: 1,
  },
  {
    level: GroupLevel.LEVEL_2,
    title: "Tilawah Al Qur'an",
    target: '70 halaman seminggu',
    fieldType: 'NUMBER' as const,
    inputScope: 'WEEKLY' as const,
    minValue: 0,
    maxValue: 100,
    isRequired: false,
    sortOrder: 2,
  },
  {
    level: GroupLevel.LEVEL_2,
    title: 'Dzikir pagi petang',
    description: 'Total dzikir pagi petang pekan ini (angka)',
    target: '7x seminggu',
    fieldType: 'NUMBER' as const,
    inputScope: 'WEEKLY' as const,
    minValue: 0,
    maxValue: 7,
    isRequired: false,
    sortOrder: 3,
  },
  {
    level: GroupLevel.LEVEL_2,
    title: 'Puasa Sunnah',
    target: '1x seminggu',
    fieldType: 'CHECKBOX' as const,
    inputScope: 'DAILY' as const,
    isRequired: false,
    sortOrder: 4,
  },
  {
    level: GroupLevel.LEVEL_2,
    title: 'Sholat Dhuha',
    target: '3x seminggu',
    fieldType: 'CHECKBOX' as const,
    inputScope: 'DAILY' as const,
    isRequired: false,
    sortOrder: 5,
  },
  {
    level: GroupLevel.LEVEL_2,
    title: 'Sholat Tahajud',
    target: '1x seminggu',
    fieldType: 'CHECKBOX' as const,
    inputScope: 'DAILY' as const,
    isRequired: false,
    sortOrder: 6,
  },
];

async function main() {
  console.log('==> Seed production (bootstrap, tanpa data dummy)');

  await prisma.groupLevelConfig.upsert({
    where: { level: GroupLevel.LEVEL_1 },
    update: { label: 'Muda' },
    create: { level: GroupLevel.LEVEL_1, label: 'Muda' },
  });
  await prisma.groupLevelConfig.upsert({
    where: { level: GroupLevel.LEVEL_2 },
    update: { label: 'Pratama' },
    create: { level: GroupLevel.LEVEL_2, label: 'Pratama' },
  });
  console.log('  ✓ Label level Muda / Pratama');

  const mutabaahCount = await prisma.mutabaahItem.count();
  if (mutabaahCount === 0) {
    await prisma.mutabaahItem.createMany({ data: MUTABAAH_ITEMS });
    console.log(`  ✓ Master mutabaah (${MUTABAAH_ITEMS.length} item)`);
  } else {
    console.log(`  · Master mutabaah sudah ada (${mutabaahCount}) — dilewati`);
  }

  console.log('  … Upsert indikator capaian');
  for (const item of IC_SEED_DATA) {
    await prisma.indikatorCapaian.upsert({
      where: {
        level_category_type_number: {
          level: item.level,
          category: item.category,
          type: item.type,
          number: item.number,
        },
      },
      update: {
        title: item.title,
        materi: item.materi,
        sortOrder: item.sortOrder,
        isActive: true,
      },
      create: item,
    });
  }
  console.log(`  ✓ Indikator capaian (${IC_SEED_DATA.length} item)`);

  let schoolsCreated = 0;
  for (const schoolName of SCHOOLS_DEPOK) {
    const existing = await prisma.school.findUnique({ where: { name: schoolName } });
    if (!existing) {
      await prisma.school.create({ data: { name: schoolName, city: 'Depok' } });
      schoolsCreated++;
    }
  }
  console.log(`  ✓ Sekolah (+${schoolsCreated} baru, total daftar ${SCHOOLS_DEPOK.length})`);

  const existingSuper = await prisma.userRole.findFirst({
    where: { role: Role.SUPERADMIN },
    select: { userId: true, user: { select: { email: true } } },
  });

  if (existingSuper) {
    console.log(`  · SUPERADMIN sudah ada (${existingSuper.user.email}) — tidak membuat ulang`);
  } else {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        gender: Gender.IKHWAN,
        password: bcrypt.hashSync(password, 12),
        roles: { create: { role: Role.SUPERADMIN } },
      },
    });
    console.log(`  ✓ SUPERADMIN dibuat: ${user.email}`);
  }

  console.log('');
  console.log('Seed production selesai.');
  console.log(`Login: ${email}`);
  console.log('Ganti password segera setelah login pertama.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
