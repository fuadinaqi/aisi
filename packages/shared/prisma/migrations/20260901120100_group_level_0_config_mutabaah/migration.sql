INSERT INTO "GroupLevelConfig" ("id", "level", "label", "updatedAt")
VALUES (gen_random_uuid()::text, 'LEVEL_0', 'Pra Dasar', NOW())
ON CONFLICT ("level") DO NOTHING;

-- Salin master Mutabaah Dasar → Pra Dasar (idempotent; hanya jika LEVEL_0 belum ada)
INSERT INTO "MutabaahItem" (
  "id", "level", "title", "description", "target", "fieldType", "inputScope",
  "options", "minValue", "maxValue", "sortOrder", "isRequired", "isActive",
  "allowOther", "otherLabel", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text, 'LEVEL_0', "title", "description", "target", "fieldType", "inputScope",
  "options", "minValue", "maxValue", "sortOrder", "isRequired", "isActive",
  "allowOther", "otherLabel", NOW(), NOW()
FROM "MutabaahItem"
WHERE "level" = 'LEVEL_1'
  AND NOT EXISTS (SELECT 1 FROM "MutabaahItem" x WHERE x."level" = 'LEVEL_0');
