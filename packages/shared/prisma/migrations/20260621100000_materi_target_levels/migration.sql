-- AlterTable
ALTER TABLE "WeeklyMateri" ADD COLUMN "targetLevels" "GroupLevel"[] NOT NULL DEFAULT ARRAY[]::"GroupLevel"[];
