-- AlterTable
ALTER TABLE "School" ADD COLUMN "address" TEXT;
ALTER TABLE "School" ADD COLUMN "mapsUrl" TEXT;

-- CreateEnum
CREATE TYPE "MentorApplicationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

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
CREATE UNIQUE INDEX "MentorNeed_schoolId_key" ON "MentorNeed"("schoolId");

-- CreateIndex
CREATE INDEX "MentorApplication_mentorNeedId_idx" ON "MentorApplication"("mentorNeedId");

-- CreateIndex
CREATE INDEX "MentorApplication_mentorNeedId_gender_status_idx" ON "MentorApplication"("mentorNeedId", "gender", "status");

-- AddForeignKey
ALTER TABLE "MentorNeed" ADD CONSTRAINT "MentorNeed_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorNeed" ADD CONSTRAINT "MentorNeed_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorApplication" ADD CONSTRAINT "MentorApplication_mentorNeedId_fkey" FOREIGN KEY ("mentorNeedId") REFERENCES "MentorNeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
