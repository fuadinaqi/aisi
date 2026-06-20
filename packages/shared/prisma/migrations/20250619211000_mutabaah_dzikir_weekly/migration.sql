-- Dzikir pagi petang: cakupan per pekan (bukan per hari)
UPDATE "MutabaahItem"
SET
  "fieldType" = 'NUMBER',
  "inputScope" = 'WEEKLY',
  "description" = 'Total dzikir pagi petang pekan ini (angka)'
WHERE "title" = 'Dzikir pagi petang';

UPDATE "MutabaahItem"
SET "target" = '5x seminggu', "maxValue" = 5
WHERE "title" = 'Dzikir pagi petang' AND "level" = 'LEVEL_1';

UPDATE "MutabaahItem"
SET "target" = '7x seminggu', "maxValue" = 7
WHERE "title" = 'Dzikir pagi petang' AND "level" = 'LEVEL_2';
