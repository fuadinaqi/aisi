-- DropIndex
DROP INDEX IF EXISTS "IndikatorCapaian_level_number_key";

-- CreateIndex
CREATE UNIQUE INDEX "IndikatorCapaian_level_category_type_number_key" ON "IndikatorCapaian"("level", "category", "type", "number");
