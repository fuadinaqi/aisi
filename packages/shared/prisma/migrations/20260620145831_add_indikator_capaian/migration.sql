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
