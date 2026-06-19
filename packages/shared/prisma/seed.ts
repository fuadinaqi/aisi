import { PrismaClient, Role, GroupLevel, AttendanceStatus, InvitationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SCHOOLS_DEPOK } from '../src/constants/index.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Group level config
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

  // Schools
  for (const name of SCHOOLS_DEPOK) {
    await prisma.school.upsert({
      where: { name },
      update: {},
      create: { name, city: 'Depok' },
    });
  }

  const schools = await prisma.school.findMany({ take: 5 });
  const hash = (pw: string) => bcrypt.hashSync(pw, 12);

  // Superadmin
  const superadmin = await prisma.user.upsert({
    where: { email: 'superadmin@dakwah.id' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'superadmin@dakwah.id',
      password: hash('SuperAdmin123!'),
      roles: { create: { role: Role.SUPERADMIN } },
    },
  });

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dakwah.id' },
    update: {},
    create: {
      name: 'Admin Depok',
      email: 'admin@dakwah.id',
      password: hash('Admin123!'),
      roles: { create: { role: Role.ADMIN } },
    },
  });

  // PJ Sekolah (3)
  const pjUsers = [];
  for (let i = 1; i <= 3; i++) {
    const pj = await prisma.user.upsert({
      where: { email: `pj${i}@dakwah.id` },
      update: {},
      create: {
        name: `PJ Sekolah ${i}`,
        email: `pj${i}@dakwah.id`,
        password: hash('PjSekolah123!'),
        roles: { create: { role: Role.PJ_SEKOLAH } },
        schools: { create: { schoolId: schools[i - 1]!.id } },
      },
    });
    pjUsers.push(pj);
  }

  // Pembina (5)
  const pembinaUsers = [];
  for (let i = 1; i <= 5; i++) {
    const pembina = await prisma.user.upsert({
      where: { email: `pembina${i}@dakwah.id` },
      update: {},
      create: {
        name: `Pembina ${i}`,
        email: `pembina${i}@dakwah.id`,
        password: hash('Pembina123!'),
        roles: { create: { role: Role.PEMBINA } },
        schools: { create: { schoolId: schools[i % schools.length]!.id } },
      },
    });
    pembinaUsers.push(pembina);
  }

  // Groups
  const groups = [];
  for (let i = 0; i < 5; i++) {
    const group = await prisma.group.upsert({
      where: { id: `seed-group-${i + 1}` },
      update: {},
      create: {
        id: `seed-group-${i + 1}`,
        name: `Kelompok ${i + 1}`,
        level: i % 2 === 0 ? GroupLevel.LEVEL_1 : GroupLevel.LEVEL_2,
        schoolId: schools[i % schools.length]!.id,
        pembinaId: pembinaUsers[i]!.id,
      },
    });
    groups.push(group);
  }

  // Anggota (20)
  const anggotaUsers = [];
  for (let i = 1; i <= 20; i++) {
    const anggota = await prisma.user.upsert({
      where: { email: `anggota${i}@dakwah.id` },
      update: {},
      create: {
        name: `Anggota ${i}`,
        email: `anggota${i}@dakwah.id`,
        password: hash('Anggota123!'),
        roles: { create: { role: Role.ANGGOTA } },
      },
    });
    anggotaUsers.push(anggota);
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: groups[(i - 1) % groups.length]!.id, userId: anggota.id } },
      update: {},
      create: { groupId: groups[(i - 1) % groups.length]!.id, userId: anggota.id },
    });
  }

  // Evaluations (2 weeks ago)
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const monday = getMonday(twoWeeksAgo);

  for (const group of groups.slice(0, 2)) {
    const members = await prisma.groupMember.findMany({
      where: { groupId: group.id, isActive: true },
      include: { user: true },
    });

    const evaluation = await prisma.weeklyEvaluation.upsert({
      where: { groupId_weekDate: { groupId: group.id, weekDate: monday } },
      update: {},
      create: {
        groupId: group.id,
        createdById: group.pembinaId,
        weekDate: monday,
        notes: 'Evaluasi pekan lalu',
        isSubmitted: true,
        submittedAt: new Date(monday.getTime() + 5 * 24 * 60 * 60 * 1000),
        attendances: {
          create: members.map((m) => ({
            userId: m.userId,
            status: AttendanceStatus.HADIR,
          })),
        },
      },
    });
    console.log(`Created evaluation ${evaluation.id}`);
  }

  // Event upcoming
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  await prisma.event.upsert({
    where: { id: 'seed-event-1' },
    update: {},
    create: {
      id: 'seed-event-1',
      title: 'Kajian Akbar Depok',
      description: 'Kajian bersama seluruh pembina dan anggota',
      location: 'Masjid Al-Ikhlas Depok',
      startAt: nextWeek,
      pointValue: 15,
      isPublished: true,
      createdById: admin.id,
    },
  });

  // Materi this week
  const thisMonday = getMonday(new Date());
  await prisma.weeklyMateri.upsert({
    where: { id: 'seed-materi-1' },
    update: {},
    create: {
      id: 'seed-materi-1',
      title: 'Materi Pekan Ini - Akhlak',
      description: 'Pembahasan tentang akhlak mulia',
      weekDate: thisMonday,
      fileUrls: [],
      createdById: admin.id,
      isPublished: true,
    },
  });
  await prisma.weeklyMateri.upsert({
    where: { id: 'seed-materi-2' },
    update: {},
    create: {
      id: 'seed-materi-2',
      title: 'Materi Pekan Ini - Shalat',
      description: 'Keutamaan shalat berjamaah',
      weekDate: thisMonday,
      fileUrls: [],
      createdById: admin.id,
      isPublished: true,
    },
  });

  // Pending invitations
  for (let i = 1; i <= 3; i++) {
    await prisma.userInvitation.upsert({
      where: { token: `00000000-0000-4000-8000-00000000000${i}` },
      update: {},
      create: {
        email: `pending${i}@dakwah.id`,
        name: `Pending User ${i}`,
        role: Role.ANGGOTA,
        groupId: groups[0]!.id,
        token: `00000000-0000-4000-8000-00000000000${i}`,
        status: InvitationStatus.PENDING,
        invitedById: pembinaUsers[0]!.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log('Seed completed!');
  console.log('Superadmin: superadmin@dakwah.id / SuperAdmin123!');
  console.log('Admin: admin@dakwah.id / Admin123!');
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
