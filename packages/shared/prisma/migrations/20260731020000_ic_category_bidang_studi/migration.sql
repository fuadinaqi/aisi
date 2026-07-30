-- Replace ICCategory enum with Bidang Studi values (Muhib M1 + Muayyid M2).
-- Existing IC master + member progress are cleared (reseed via seed-production / seed).

DELETE FROM "MemberICProgress";
DELETE FROM "IndikatorCapaian";

ALTER TABLE "IndikatorCapaian" ALTER COLUMN "category" TYPE TEXT;
DROP TYPE "ICCategory";

CREATE TYPE "ICCategory" AS ENUM (
  'MANA_ASY_SYAHADAH',
  'MARIFATULLAH',
  'MARIFATUR_RASUL',
  'MARIFATUL_ISLAM',
  'MARIFATUL_INSAN',
  'MARIFATUL_QURAN',
  'FIQIH_USHUL_FIQIH',
  'KETATANEGARAAN',
  'LIFESKILLS',
  'ALQURAN_ULUMUL_QURAN',
  'HADITS_ULUMUL_HADITS',
  'AQIDAH_AKHLAK',
  'AL_HAQ_WAL_BATHIL',
  'QADHAYA_TAKWINUL_UMMAH',
  'DAKWAH_FIKRAH'
);

ALTER TABLE "IndikatorCapaian"
  ALTER COLUMN "category" TYPE "ICCategory"
  USING "category"::"ICCategory";
