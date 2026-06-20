-- AlterTable
ALTER TABLE "MutabaahItem" ADD COLUMN "allowOther" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MutabaahItem" ADD COLUMN "otherLabel" TEXT NOT NULL DEFAULT 'Lainnya';
