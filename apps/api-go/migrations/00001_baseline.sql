-- +goose Up
-- Baseline schema from Prisma migrations (freeze). Fresh installs apply this once.

-- From 20250619000000_init
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH', 'PEMBINA', 'ANGGOTA');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('HADIR', 'TIDAK_HADIR', 'IZIN', 'SAKIT');

-- CreateEnum
CREATE TYPE "GroupLevel" AS ENUM ('LEVEL_1', 'LEVEL_2');

-- CreateEnum
CREATE TYPE "NotifType" AS ENUM ('REMINDER_FORM', 'NEW_EVENT', 'NEW_MATERI', 'POINT_EARNED', 'GENERAL');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'USED', 'EXPIRED');

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Depok',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSchool" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    CONSTRAINT "UserSchool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupLevelConfig" (
    "id" TEXT NOT NULL,
    "level" "GroupLevel" NOT NULL,
    "label" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GroupLevelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" "GroupLevel" NOT NULL,
    "schoolId" TEXT NOT NULL,
    "pembinaId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyEvaluation" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "weekDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "photoUrls" TEXT[],
    "isSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeeklyEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationAttendance" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'HADIR',
    "note" TEXT,
    CONSTRAINT "EvaluationAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "pointValue" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAttendance" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyMateri" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "weekDate" TIMESTAMP(3) NOT NULL,
    "fileUrls" TEXT[],
    "createdById" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeeklyMateri_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotifType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "refId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "schoolId" TEXT,
    "groupId" TEXT,
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_name_key" ON "School"("name");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");
CREATE UNIQUE INDEX "UserSchool_userId_schoolId_key" ON "UserSchool"("userId", "schoolId");
CREATE UNIQUE INDEX "GroupLevelConfig_level_key" ON "GroupLevelConfig"("level");
CREATE INDEX "Group_schoolId_idx" ON "Group"("schoolId");
CREATE INDEX "Group_pembinaId_idx" ON "Group"("pembinaId");
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");
CREATE INDEX "WeeklyEvaluation_groupId_idx" ON "WeeklyEvaluation"("groupId");
CREATE INDEX "WeeklyEvaluation_weekDate_idx" ON "WeeklyEvaluation"("weekDate");
CREATE UNIQUE INDEX "WeeklyEvaluation_groupId_weekDate_key" ON "WeeklyEvaluation"("groupId", "weekDate");
CREATE UNIQUE INDEX "EvaluationAttendance_evaluationId_userId_key" ON "EvaluationAttendance"("evaluationId", "userId");
CREATE INDEX "PointLog_userId_idx" ON "PointLog"("userId");
CREATE UNIQUE INDEX "EventAttendance_eventId_userId_key" ON "EventAttendance"("eventId", "userId");
CREATE INDEX "WeeklyMateri_weekDate_idx" ON "WeeklyMateri"("weekDate");
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");
CREATE UNIQUE INDEX "UserInvitation_token_key" ON "UserInvitation"("token");
CREATE INDEX "UserInvitation_token_idx" ON "UserInvitation"("token");
CREATE INDEX "UserInvitation_email_idx" ON "UserInvitation"("email");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSchool" ADD CONSTRAINT "UserSchool_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSchool" ADD CONSTRAINT "UserSchool_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Group" ADD CONSTRAINT "Group_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Group" ADD CONSTRAINT "Group_pembinaId_fkey" FOREIGN KEY ("pembinaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyEvaluation" ADD CONSTRAINT "WeeklyEvaluation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WeeklyEvaluation" ADD CONSTRAINT "WeeklyEvaluation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EvaluationAttendance" ADD CONSTRAINT "EvaluationAttendance_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "WeeklyEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EvaluationAttendance" ADD CONSTRAINT "EvaluationAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PointLog" ADD CONSTRAINT "PointLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventAttendance" ADD CONSTRAINT "EventAttendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventAttendance" ADD CONSTRAINT "EventAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- From 20250619120000_event_checkin
-- AlterTable Event and EventAttendance for check-in workflow

CREATE TYPE "EventCheckInStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

DELETE FROM "EventAttendance";

ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
UPDATE "Event" SET "endAt" = "startAt" + interval '2 hours' WHERE "endAt" IS NULL;
ALTER TABLE "Event" ALTER COLUMN "endAt" SET NOT NULL;
ALTER TABLE "Event" ALTER COLUMN "isPublished" SET DEFAULT true;

ALTER TABLE "EventAttendance" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
ALTER TABLE "EventAttendance" ADD COLUMN IF NOT EXISTS "status" "EventCheckInStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "EventAttendance" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
ALTER TABLE "EventAttendance" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "EventAttendance" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "EventAttendance" ADD COLUMN IF NOT EXISTS "rejectionNote" TEXT;

ALTER TABLE "Event" ADD CONSTRAINT "Event_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventAttendance" ADD CONSTRAINT "EventAttendance_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventAttendance" ADD CONSTRAINT "EventAttendance_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Event_schoolId_idx" ON "Event"("schoolId");
CREATE INDEX IF NOT EXISTS "Event_endAt_idx" ON "Event"("endAt");
CREATE INDEX IF NOT EXISTS "EventAttendance_groupId_status_idx" ON "EventAttendance"("groupId", "status");

ALTER TABLE "EventAttendance" ALTER COLUMN "photoUrl" SET NOT NULL;
ALTER TABLE "EventAttendance" ALTER COLUMN "groupId" SET NOT NULL;


-- From 20250619140000_materi_content
-- Materi content types: file, link, or rich text

CREATE TYPE "MateriContentType" AS ENUM ('FILE', 'LINK', 'RICH_TEXT');

ALTER TABLE "WeeklyMateri" ADD COLUMN IF NOT EXISTS "contentType" "MateriContentType" NOT NULL DEFAULT 'RICH_TEXT';
ALTER TABLE "WeeklyMateri" ADD COLUMN IF NOT EXISTS "linkUrl" TEXT;
ALTER TABLE "WeeklyMateri" ADD COLUMN IF NOT EXISTS "contentHtml" TEXT;


-- From 20250619160000_event_target_levels
-- AlterTable
ALTER TABLE "Event" ADD COLUMN "targetLevels" "GroupLevel"[] NOT NULL DEFAULT ARRAY[]::"GroupLevel"[];


-- From 20250619180000_mutabaah_yaumiyah
-- CreateEnum
CREATE TYPE "MutabaahFieldType" AS ENUM ('CHECKBOX', 'NUMBER', 'TEXT', 'SELECT');

-- CreateEnum
CREATE TYPE "MutabaahInputScope" AS ENUM ('WEEKLY', 'DAILY');

-- CreateTable
CREATE TABLE "MutabaahItem" (
    "id" TEXT NOT NULL,
    "level" "GroupLevel" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "target" TEXT,
    "fieldType" "MutabaahFieldType" NOT NULL,
    "inputScope" "MutabaahInputScope" NOT NULL DEFAULT 'WEEKLY',
    "options" JSONB,
    "minValue" INTEGER,
    "maxValue" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MutabaahItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MutabaahEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "weekDate" TIMESTAMP(3) NOT NULL,
    "isSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MutabaahEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MutabaahAnswer" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "MutabaahAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MutabaahItem_level_isActive_sortOrder_idx" ON "MutabaahItem"("level", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "MutabaahEntry_groupId_weekDate_idx" ON "MutabaahEntry"("groupId", "weekDate");

-- CreateIndex
CREATE UNIQUE INDEX "MutabaahEntry_userId_groupId_weekDate_key" ON "MutabaahEntry"("userId", "groupId", "weekDate");

-- CreateIndex
CREATE UNIQUE INDEX "MutabaahAnswer_entryId_itemId_key" ON "MutabaahAnswer"("entryId", "itemId");

-- AddForeignKey
ALTER TABLE "MutabaahEntry" ADD CONSTRAINT "MutabaahEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutabaahEntry" ADD CONSTRAINT "MutabaahEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutabaahAnswer" ADD CONSTRAINT "MutabaahAnswer_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MutabaahEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutabaahAnswer" ADD CONSTRAINT "MutabaahAnswer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MutabaahItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- From 20250619200000_mutabaah_allow_other
-- AlterTable
ALTER TABLE "MutabaahItem" ADD COLUMN "allowOther" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MutabaahItem" ADD COLUMN "otherLabel" TEXT NOT NULL DEFAULT 'Lainnya';


-- From 20250619210000_mutabaah_dzikir_number
-- Pastikan Dzikir pagi petang: tipe NUMBER, cakupan per pekan
UPDATE "MutabaahItem"
SET
  "fieldType" = 'NUMBER',
  "inputScope" = 'WEEKLY',
  "description" = 'Total dzikir pagi petang pekan ini (angka)'
WHERE "title" = 'Dzikir pagi petang';

UPDATE "MutabaahItem"
SET "target" = '5x seminggu', "maxValue" = 5
WHERE "title" = 'Dzikir pagi petang' AND "level" = 'LEVEL_1';

UPDATE "MutabaahItem"
SET "target" = '7x seminggu', "maxValue" = 7
WHERE "title" = 'Dzikir pagi petang' AND "level" = 'LEVEL_2';


-- From 20250619211000_mutabaah_dzikir_weekly
-- Dzikir pagi petang: cakupan per pekan (bukan per hari)
UPDATE "MutabaahItem"
SET
  "fieldType" = 'NUMBER',
  "inputScope" = 'WEEKLY',
  "description" = 'Total dzikir pagi petang pekan ini (angka)'
WHERE "title" = 'Dzikir pagi petang';

UPDATE "MutabaahItem"
SET "target" = '5x seminggu', "maxValue" = 5
WHERE "title" = 'Dzikir pagi petang' AND "level" = 'LEVEL_1';

UPDATE "MutabaahItem"
SET "target" = '7x seminggu', "maxValue" = 7
WHERE "title" = 'Dzikir pagi petang' AND "level" = 'LEVEL_2';


-- From 20260620145831_add_indikator_capaian
-- CreateEnum
CREATE TYPE "ICCategory" AS ENUM ('KEAGAMAAN', 'KEBANGSAAN', 'KEMASYARAKATAN', 'KEORGANISASIAN', 'KEPEMIMPINAN_KEWIRAUSAHAAN');

-- CreateEnum
CREATE TYPE "ICType" AS ENUM ('PRIMER', 'SEKUNDER');

-- CreateTable
CREATE TABLE "IndikatorCapaian" (
    "id" TEXT NOT NULL,
    "level" "GroupLevel" NOT NULL,
    "category" "ICCategory" NOT NULL,
    "type" "ICType" NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "materi" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndikatorCapaian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberICProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "indikatorId" TEXT NOT NULL,
    "isAchieved" BOOLEAN NOT NULL DEFAULT false,
    "checkedById" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberICProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IndikatorCapaian_level_category_type_sortOrder_idx" ON "IndikatorCapaian"("level", "category", "type", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "IndikatorCapaian_level_number_key" ON "IndikatorCapaian"("level", "number");

-- CreateIndex
CREATE INDEX "MemberICProgress_groupId_userId_idx" ON "MemberICProgress"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberICProgress_userId_groupId_indikatorId_key" ON "MemberICProgress"("userId", "groupId", "indikatorId");

-- AddForeignKey
ALTER TABLE "MemberICProgress" ADD CONSTRAINT "MemberICProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberICProgress" ADD CONSTRAINT "MemberICProgress_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberICProgress" ADD CONSTRAINT "MemberICProgress_indikatorId_fkey" FOREIGN KEY ("indikatorId") REFERENCES "IndikatorCapaian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberICProgress" ADD CONSTRAINT "MemberICProgress_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- From 20260620150500_fix_ic_unique_constraint
-- DropIndex
DROP INDEX IF EXISTS "IndikatorCapaian_level_number_key";

-- CreateIndex
CREATE UNIQUE INDEX "IndikatorCapaian_level_category_type_number_key" ON "IndikatorCapaian"("level", "category", "type", "number");


-- From 20260620180000_add_feedback_kks
-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('KELUHAN', 'KRITIK', 'SARAN');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('PENDING', 'READ', 'RESOLVED');

-- AlterEnum
ALTER TYPE "NotifType" ADD VALUE 'NEW_KKS';

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- From 20260620190000_add_gender_ikhwan_akhwat
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('IKHWAN', 'AKHWAT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "gender" "Gender" NOT NULL DEFAULT 'IKHWAN';

-- AlterTable
ALTER TABLE "Group" ADD COLUMN "gender" "Gender" NOT NULL DEFAULT 'IKHWAN';

-- AlterTable
ALTER TABLE "UserInvitation" ADD COLUMN "gender" "Gender";


-- From 20260621100000_materi_target_levels
-- AlterTable
ALTER TABLE "WeeklyMateri" ADD COLUMN "targetLevels" "GroupLevel"[] NOT NULL DEFAULT ARRAY[]::"GroupLevel"[];


-- +goose Down
-- Irreversible baseline; restore from backup if needed.
