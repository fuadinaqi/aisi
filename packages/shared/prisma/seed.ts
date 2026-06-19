import { PrismaClient, Role, GroupLevel, AttendanceStatus, InvitationStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD = {
  superadmin: '!Superadmin123',
  admin: '!Admin123',
  pj: '!Password123',
  pembina: '!Password123',
  anggota: '!Password123',
} as const;

const SCHOOLS = ['SMAN 1 Depok', 'SMAN 2 Depok', 'SMAN 3 Depok'] as const;

const PJ_SEKOLAH = [
  { name: 'Usamah', email: 'usamah_sman1@gmail.com', school: 'SMAN 1 Depok' },
  { name: 'Naufal', email: 'naufal_sman2@gmail.com', school: 'SMAN 2 Depok' },
  { name: 'Farid', email: 'farid_sman3@gmail.com', school: 'SMAN 3 Depok' },
] as const;

/** Jumlah kelompok per sekolah (acak 2–3) */
const GROUPS_PER_SCHOOL = [3, 2, 3] as const;

const PEMBINA_NAMES = [
  'Budi Santoso',
  'Siti Rahmawati',
  'Agus Prasetyo',
  'Dewi Lestari',
  'Rizki Maulana',
  'Fitriani Putri',
  'Hendra Wijaya',
  'Nurul Hidayah',
  'Eko Saputra',
  'Maya Anggraini',
] as const;

const ANGGOTA_NAMES = [
  'Ahmad Fauzi',
  'Bima Aditya',
  'Candra Wijaya',
  'Dian Pratama',
  'Eka Suryadi',
  'Fajar Nugroho',
  'Galih Ramadhan',
  'Hana Safitri',
  'Indra Kusuma',
  'Joko Susilo',
  'Kartika Sari',
  'Lutfi Hakim',
  'Mira Delima',
  'Nanda Permana',
  'Oki Pratama',
  'Putri Ayu',
  'Qori Sandi',
  'Rafi Akbar',
  'Salsa Maharani',
  'Teguh Prasetyo',
  'Umar Faruq',
  'Vina Oktavia',
  'Wahyu Setiawan',
  'Yusuf Ibrahim',
  'Zahra Nabila',
  'Adit Mahendra',
  'Bayu Ramadani',
  'Citra Lestari',
  'Doni Pratama',
  'Elsa Anggraini',
  'Fadhil Rahman',
  'Gita Puspita',
  'Hafiz Maulana',
  'Intan Permata',
  'Jaya Kusuma',
  'Kevin Alfarizi',
  'Lia Marlina',
  'Miko Ardiansyah',
  'Nisa Rahmawati',
  'Omar Syarif',
] as const;

const GROUP_LABELS = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];

function hash(pw: string) {
  return bcrypt.hashSync(pw, 12);
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function clearDatabase() {
  console.log('Menghapus data lama...');
  await prisma.evaluationAttendance.deleteMany();
  await prisma.weeklyEvaluation.deleteMany();
  await prisma.groupMember.deleteMany();
  await prisma.pointLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.eventAttendance.deleteMany();
  await prisma.userInvitation.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.userSchool.deleteMany();
  await prisma.group.deleteMany();
  await prisma.event.deleteMany();
  await prisma.weeklyMateri.deleteMany();
  await prisma.user.deleteMany();
  await prisma.school.deleteMany();
}

async function main() {
  console.log('Seeding database...');

  await clearDatabase();

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

  const schoolRecords = [];
  for (const name of SCHOOLS) {
    const school = await prisma.school.create({
      data: { name, city: 'Depok' },
    });
    schoolRecords.push(school);
  }

  const schoolByName = Object.fromEntries(schoolRecords.map((s) => [s.name, s]));

  const superadmin = await prisma.user.create({
    data: {
      name: 'Fuad Inaqi',
      email: 'fuadinaqi@gmail.com',
      password: hash(PASSWORD.superadmin),
      roles: { create: { role: Role.SUPERADMIN } },
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: 'Fuad Project',
      email: 'fuadiproject@gmail.com',
      password: hash(PASSWORD.admin),
      roles: { create: { role: Role.ADMIN } },
    },
  });

  for (const pj of PJ_SEKOLAH) {
    await prisma.user.create({
      data: {
        name: pj.name,
        email: pj.email,
        password: hash(PASSWORD.pj),
        roles: { create: { role: Role.PJ_SEKOLAH } },
        schools: { create: { schoolId: schoolByName[pj.school]!.id } },
      },
    });
  }

  let pembinaIndex = 0;
  let anggotaIndex = 0;
  const groups = [];

  for (let sIdx = 0; sIdx < SCHOOLS.length; sIdx++) {
    const schoolName = SCHOOLS[sIdx]!;
    const school = schoolByName[schoolName]!;
    const groupCount = GROUPS_PER_SCHOOL[sIdx]!;
    const schoolShort = `sman${sIdx + 1}`;

    for (let gIdx = 0; gIdx < groupCount; gIdx++) {
      const pembinaName = PEMBINA_NAMES[pembinaIndex]!;
      pembinaIndex += 1;

      const pembina = await prisma.user.create({
        data: {
          name: pembinaName,
          email: `${slugify(pembinaName)}.${schoolShort}.pembina@gmail.com`,
          password: hash(PASSWORD.pembina),
          roles: { create: { role: Role.PEMBINA } },
          schools: { create: { schoolId: school.id } },
        },
      });

      const level = gIdx % 2 === 0 ? GroupLevel.LEVEL_1 : GroupLevel.LEVEL_2;
      const levelLabel = level === GroupLevel.LEVEL_1 ? 'Muda' : 'Pratama';

      const group = await prisma.group.create({
        data: {
          name: `Kelompok ${levelLabel} ${GROUP_LABELS[gIdx] ?? gIdx + 1}`,
          level,
          schoolId: school.id,
          pembinaId: pembina.id,
        },
      });
      groups.push(group);

      const memberCount = 5 + (gIdx % 3);
      for (let m = 0; m < memberCount; m++) {
        const anggotaName = ANGGOTA_NAMES[anggotaIndex % ANGGOTA_NAMES.length]!;
        anggotaIndex += 1;

        const anggota = await prisma.user.create({
          data: {
            name: anggotaName,
            email: `${slugify(anggotaName)}.${schoolShort}.g${gIdx + 1}@gmail.com`,
            password: hash(PASSWORD.anggota),
            roles: { create: { role: Role.ANGGOTA } },
          },
        });

        await prisma.groupMember.create({
          data: { groupId: group.id, userId: anggota.id },
        });
      }

      console.log(
        `  ${schoolName} · ${group.name} · ${memberCount} anggota · Pembina: ${pembinaName}`,
      );
    }
  }

  const twoWeeksAgo = getMonday(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000));
  for (const group of groups.slice(0, 3)) {
    const members = await prisma.groupMember.findMany({
      where: { groupId: group.id, isActive: true },
    });

    await prisma.weeklyEvaluation.create({
      data: {
        groupId: group.id,
        createdById: group.pembinaId,
        weekDate: twoWeeksAgo,
        notes: 'Evaluasi pekan lalu',
        isSubmitted: true,
        submittedAt: new Date(twoWeeksAgo.getTime() + 4 * 24 * 60 * 60 * 1000),
        attendances: {
          create: members.map((m, i) => ({
            userId: m.userId,
            status:
              i === members.length - 1 && members.length > 2
                ? AttendanceStatus.IZIN
                : AttendanceStatus.HADIR,
          })),
        },
      },
    });
  }

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekEnd = new Date(nextWeek);
  nextWeekEnd.setHours(nextWeekEnd.getHours() + 3);

  const ongoingStart = new Date();
  ongoingStart.setHours(ongoingStart.getHours() - 1);
  const ongoingEnd = new Date();
  ongoingEnd.setHours(ongoingEnd.getHours() + 4);

  await prisma.event.createMany({
    data: [
      {
        title: 'Kajian Akbar Depok',
        description: 'Kajian bersama seluruh pembina dan anggota AISI',
        location: 'Masjid Al-Ikhlas Depok',
        startAt: nextWeek,
        endAt: nextWeekEnd,
        pointValue: 10,
        isPublished: true,
        createdById: admin.id,
        schoolId: null,
      },
      {
        title: 'Kajian Kelompok (Sedang Berlangsung)',
        description: 'Event contoh untuk uji check-in anggota',
        location: 'Aula SMAN 1 Depok',
        startAt: ongoingStart,
        endAt: ongoingEnd,
        pointValue: 5,
        isPublished: true,
        createdById: admin.id,
        schoolId: schoolRecords[0]!.id,
      },
    ],
  });

  const thisMonday = getMonday(new Date());
  await prisma.weeklyMateri.createMany({
    data: [
      {
        title: 'Materi Pekan Ini — Akhlak',
        description: 'Pembahasan tentang akhlak mulia',
        weekDate: thisMonday,
        contentType: 'RICH_TEXT',
        contentHtml:
          '<h2>Akhlak Mulia</h2><p>Materi pekan ini membahas pentingnya menjaga akhlak dalam kehidupan sehari-hari.</p><ul><li>Kejujuran</li><li>Sabar</li><li>Menjaga lidah</li></ul>',
        fileUrls: [],
        createdById: admin.id,
        isPublished: true,
      },
      {
        title: 'Materi Pekan Ini — Shalat',
        description: 'Keutamaan shalat berjamaah',
        weekDate: thisMonday,
        contentType: 'LINK',
        linkUrl: 'https://example.com/materi-shalat',
        fileUrls: [],
        createdById: admin.id,
        isPublished: true,
      },
    ],
  });

  await prisma.userInvitation.create({
    data: {
      email: 'calon.anggota@gmail.com',
      name: 'Calon Anggota',
      role: Role.ANGGOTA,
      groupId: groups[0]!.id,
      token: '00000000-0000-4000-8000-000000000001',
      status: InvitationStatus.PENDING,
      invitedById: groups[0]!.pembinaId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('\nSeed selesai!\n');
  console.log('=== Akun utama ===');
  console.log(`Superadmin : fuadinaqi@gmail.com / ${PASSWORD.superadmin}`);
  console.log(`Admin      : fuadiproject@gmail.com / ${PASSWORD.admin}`);
  console.log('\n=== PJ Sekolah ===');
  for (const pj of PJ_SEKOLAH) {
    console.log(`${pj.name.padEnd(8)} : ${pj.email} / ${PASSWORD.pj} (${pj.school})`);
  }
  console.log('\n=== Pembina & Anggota ===');
  console.log(`Password pembina : ${PASSWORD.pembina}`);
  console.log(`Password anggota : ${PASSWORD.anggota}`);
  console.log(`Total sekolah    : ${SCHOOLS.length}`);
  console.log(`Total kelompok   : ${groups.length}`);
  console.log(`Kelompok/sekolah : ${GROUPS_PER_SCHOOL.join(', ')}`);
  console.log(`Superadmin id    : ${superadmin.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
