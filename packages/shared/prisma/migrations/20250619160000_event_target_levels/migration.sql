-- AlterTable
ALTER TABLE "Event" ADD COLUMN "targetLevels" "GroupLevel"[] NOT NULL DEFAULT ARRAY[]::"GroupLevel"[];
