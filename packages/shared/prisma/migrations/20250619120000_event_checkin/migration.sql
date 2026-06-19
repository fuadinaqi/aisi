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
