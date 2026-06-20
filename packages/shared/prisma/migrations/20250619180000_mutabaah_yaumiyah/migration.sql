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
