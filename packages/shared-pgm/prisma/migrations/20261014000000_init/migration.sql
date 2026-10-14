-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPERADMIN', 'ADMIN', 'PJ_SEKOLAH', 'PEMBINA', 'ANGGOTA');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('HADIR', 'TIDAK_HADIR', 'IZIN', 'SAKIT');

-- CreateEnum
CREATE TYPE "GroupLevel" AS ENUM ('LEVEL_0', 'LEVEL_1', 'LEVEL_2');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('IKHWAN', 'AKHWAT');

-- CreateEnum
CREATE TYPE "NotifType" AS ENUM ('REMINDER_FORM', 'NEW_EVENT', 'NEW_MATERI', 'POINT_EARNED', 'NEW_KKS', 'NEW_MENTOR_APPLICATION', 'GENERAL');

-- CreateEnum
CREATE TYPE "FeedbackType" AS ENUM ('KELUHAN', 'KRITIK', 'SARAN');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('PENDING', 'READ', 'RESOLVED');

-- CreateEnum
CREATE TYPE "EventCheckInStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MateriContentType" AS ENUM ('FILE', 'LINK', 'RICH_TEXT');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'USED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MutabaahFieldType" AS ENUM ('CHECKBOX', 'NUMBER', 'TEXT', 'SELECT');

-- CreateEnum
CREATE TYPE "MutabaahInputScope" AS ENUM ('WEEKLY', 'DAILY');

-- CreateEnum
CREATE TYPE "ICCategory" AS ENUM ('MANA_ASY_SYAHADAH', 'MARIFATULLAH', 'MARIFATUR_RASUL', 'MARIFATUL_ISLAM', 'MARIFATUL_INSAN', 'MARIFATUL_QURAN', 'FIQIH_USHUL_FIQIH', 'KETATANEGARAAN', 'LIFESKILLS', 'ALQURAN_ULUMUL_QURAN', 'HADITS_ULUMUL_HADITS', 'AQIDAH_AKHLAK', 'AL_HAQ_WAL_BATHIL', 'QADHAYA_TAKWINUL_UMMAH', 'DAKWAH_FIKRAH');

-- CreateEnum
CREATE TYPE "ICType" AS ENUM ('PRIMER', 'SEKUNDER');

-- CreateEnum
CREATE TYPE "MentorApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Depok',
    "address" TEXT,
    "mapsUrl" TEXT,
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
    "gender" "Gender" NOT NULL DEFAULT 'IKHWAN',
    "birthPlace" TEXT,
    "birthDate" DATE,
    "address" TEXT,
    "tiktok" TEXT,
    "instagram" TEXT,
    "facebook" TEXT,
    "socialX" TEXT,
    "fatherName" TEXT,
    "fatherPhone" TEXT,
    "motherName" TEXT,
    "motherPhone" TEXT,
    "hobby" TEXT,
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
    "gender" "Gender" NOT NULL,
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
    "endAt" TIMESTAMP(3) NOT NULL,
    "pointValue" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "schoolId" TEXT,
    "targetLevels" "GroupLevel"[] DEFAULT ARRAY[]::"GroupLevel"[],
    "targetGender" "Gender",
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
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
    "groupId" TEXT NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "status" "EventCheckInStatus" NOT NULL DEFAULT 'PENDING',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,

    CONSTRAINT "EventAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyMateri" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "weekDate" TIMESTAMP(3) NOT NULL,
    "contentType" "MateriContentType" NOT NULL DEFAULT 'RICH_TEXT',
    "linkUrl" TEXT,
    "contentHtml" TEXT,
    "fileUrls" TEXT[],
    "fileNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "targetLevels" "GroupLevel"[] DEFAULT ARRAY[]::"GroupLevel"[],
    "schoolId" TEXT,
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
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInvitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL,
    "alsoAsPembina" BOOLEAN NOT NULL DEFAULT false,
    "schoolId" TEXT,
    "groupId" TEXT,
    "gender" "Gender",
    "token" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInvitation_pkey" PRIMARY KEY ("id")
);

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
    "allowOther" BOOLEAN NOT NULL DEFAULT false,
    "otherLabel" TEXT NOT NULL DEFAULT 'Lainnya',
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

-- CreateTable
CREATE TABLE "MentorNeed" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "needIkhwan" INTEGER NOT NULL DEFAULT 0,
    "needAkhwat" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorNeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorApplication" (
    "id" TEXT NOT NULL,
    "mentorNeedId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" "Gender" NOT NULL,
    "address" TEXT NOT NULL,
    "asalSma" TEXT NOT NULL,
    "murobbiName" TEXT NOT NULL,
    "murobbiWhatsapp" TEXT NOT NULL,
    "status" "MentorApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "School_name_key" ON "School"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "UserSchool_userId_schoolId_key" ON "UserSchool"("userId", "schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupLevelConfig_level_key" ON "GroupLevelConfig"("level");

-- CreateIndex
CREATE INDEX "Group_schoolId_idx" ON "Group"("schoolId");

-- CreateIndex
CREATE INDEX "Group_pembinaId_idx" ON "Group"("pembinaId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "WeeklyEvaluation_groupId_idx" ON "WeeklyEvaluation"("groupId");

-- CreateIndex
CREATE INDEX "WeeklyEvaluation_weekDate_idx" ON "WeeklyEvaluation"("weekDate");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyEvaluation_groupId_weekDate_key" ON "WeeklyEvaluation"("groupId", "weekDate");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationAttendance_evaluationId_userId_key" ON "EvaluationAttendance"("evaluationId", "userId");

-- CreateIndex
CREATE INDEX "PointLog_userId_idx" ON "PointLog"("userId");

-- CreateIndex
CREATE INDEX "Event_schoolId_idx" ON "Event"("schoolId");

-- CreateIndex
CREATE INDEX "Event_endAt_idx" ON "Event"("endAt");

-- CreateIndex
CREATE INDEX "EventAttendance_groupId_status_idx" ON "EventAttendance"("groupId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EventAttendance_eventId_userId_key" ON "EventAttendance"("eventId", "userId");

-- CreateIndex
CREATE INDEX "WeeklyMateri_weekDate_idx" ON "WeeklyMateri"("weekDate");

-- CreateIndex
CREATE INDEX "WeeklyMateri_schoolId_idx" ON "WeeklyMateri"("schoolId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserInvitation_token_key" ON "UserInvitation"("token");

-- CreateIndex
CREATE INDEX "UserInvitation_token_idx" ON "UserInvitation"("token");

-- CreateIndex
CREATE INDEX "UserInvitation_email_idx" ON "UserInvitation"("email");

-- CreateIndex
CREATE INDEX "MutabaahItem_level_isActive_sortOrder_idx" ON "MutabaahItem"("level", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "MutabaahEntry_groupId_weekDate_idx" ON "MutabaahEntry"("groupId", "weekDate");

-- CreateIndex
CREATE UNIQUE INDEX "MutabaahEntry_userId_groupId_weekDate_key" ON "MutabaahEntry"("userId", "groupId", "weekDate");

-- CreateIndex
CREATE UNIQUE INDEX "MutabaahAnswer_entryId_itemId_key" ON "MutabaahAnswer"("entryId", "itemId");

-- CreateIndex
CREATE INDEX "IndikatorCapaian_level_category_type_sortOrder_idx" ON "IndikatorCapaian"("level", "category", "type", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "IndikatorCapaian_level_category_type_number_key" ON "IndikatorCapaian"("level", "category", "type", "number");

-- CreateIndex
CREATE INDEX "MemberICProgress_groupId_userId_idx" ON "MemberICProgress"("groupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberICProgress_userId_groupId_indikatorId_key" ON "MemberICProgress"("userId", "groupId", "indikatorId");

-- CreateIndex
CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MentorNeed_schoolId_key" ON "MentorNeed"("schoolId");

-- CreateIndex
CREATE INDEX "MentorApplication_mentorNeedId_idx" ON "MentorApplication"("mentorNeedId");

-- CreateIndex
CREATE INDEX "MentorApplication_mentorNeedId_gender_status_idx" ON "MentorApplication"("mentorNeedId", "gender", "status");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSchool" ADD CONSTRAINT "UserSchool_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSchool" ADD CONSTRAINT "UserSchool_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_pembinaId_fkey" FOREIGN KEY ("pembinaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyEvaluation" ADD CONSTRAINT "WeeklyEvaluation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyEvaluation" ADD CONSTRAINT "WeeklyEvaluation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationAttendance" ADD CONSTRAINT "EvaluationAttendance_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "WeeklyEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationAttendance" ADD CONSTRAINT "EvaluationAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointLog" ADD CONSTRAINT "PointLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendance" ADD CONSTRAINT "EventAttendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendance" ADD CONSTRAINT "EventAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendance" ADD CONSTRAINT "EventAttendance_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendance" ADD CONSTRAINT "EventAttendance_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyMateri" ADD CONSTRAINT "WeeklyMateri_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInvitation" ADD CONSTRAINT "UserInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutabaahEntry" ADD CONSTRAINT "MutabaahEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutabaahEntry" ADD CONSTRAINT "MutabaahEntry_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutabaahAnswer" ADD CONSTRAINT "MutabaahAnswer_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MutabaahEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutabaahAnswer" ADD CONSTRAINT "MutabaahAnswer_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "MutabaahItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberICProgress" ADD CONSTRAINT "MemberICProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberICProgress" ADD CONSTRAINT "MemberICProgress_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberICProgress" ADD CONSTRAINT "MemberICProgress_indikatorId_fkey" FOREIGN KEY ("indikatorId") REFERENCES "IndikatorCapaian"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberICProgress" ADD CONSTRAINT "MemberICProgress_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorNeed" ADD CONSTRAINT "MentorNeed_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorNeed" ADD CONSTRAINT "MentorNeed_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorApplication" ADD CONSTRAINT "MentorApplication_mentorNeedId_fkey" FOREIGN KEY ("mentorNeedId") REFERENCES "MentorNeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
