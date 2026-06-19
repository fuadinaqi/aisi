-- Materi content types: file, link, or rich text

CREATE TYPE "MateriContentType" AS ENUM ('FILE', 'LINK', 'RICH_TEXT');

ALTER TABLE "WeeklyMateri" ADD COLUMN IF NOT EXISTS "contentType" "MateriContentType" NOT NULL DEFAULT 'RICH_TEXT';
ALTER TABLE "WeeklyMateri" ADD COLUMN IF NOT EXISTS "linkUrl" TEXT;
ALTER TABLE "WeeklyMateri" ADD COLUMN IF NOT EXISTS "contentHtml" TEXT;
