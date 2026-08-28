-- Email dicocokkan case-insensitive. Rapikan data lama ke lowercase
-- (lewati baris User yang akan bentrok unique "email").
UPDATE "User" AS u
SET "email" = LOWER(u."email"),
    "updatedAt" = NOW()
WHERE u."email" <> LOWER(u."email")
  AND NOT EXISTS (
    SELECT 1
    FROM "User" AS other
    WHERE other."id" <> u."id"
      AND LOWER(other."email") = LOWER(u."email")
  );

UPDATE "UserInvitation"
SET "email" = LOWER("email")
WHERE "email" <> LOWER("email");

CREATE INDEX IF NOT EXISTS "User_email_lower_idx" ON "User" (LOWER("email"));
CREATE INDEX IF NOT EXISTS "UserInvitation_email_lower_idx" ON "UserInvitation" (LOWER("email"));
