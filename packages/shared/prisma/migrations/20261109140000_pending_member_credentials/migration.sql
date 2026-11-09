-- Anggota pending: email/password nullable, aktivasi lewat UserInvitation.targetUserId

DROP INDEX IF EXISTS "User_email_key";

ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ALTER COLUMN "password" DROP NOT NULL;

ALTER TABLE "User" ADD CONSTRAINT "User_credentials_pair_check" CHECK (
  ("email" IS NULL AND "password" IS NULL)
  OR ("email" IS NOT NULL AND "password" IS NOT NULL)
);

CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (LOWER("email")) WHERE "email" IS NOT NULL;

ALTER TABLE "UserInvitation" ADD COLUMN "targetUserId" TEXT;

ALTER TABLE "UserInvitation"
  ADD CONSTRAINT "UserInvitation_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "UserInvitation_targetUserId_idx" ON "UserInvitation"("targetUserId");

CREATE UNIQUE INDEX "UserInvitation_target_pending_key"
  ON "UserInvitation" ("targetUserId")
  WHERE "status" = 'PENDING' AND "targetUserId" IS NOT NULL;
