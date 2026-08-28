-- Nama asli file materi (sejajar dengan fileUrls). Storage tetap memakai UUID.
ALTER TABLE "WeeklyMateri" ADD COLUMN "fileNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
