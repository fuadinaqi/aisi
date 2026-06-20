-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('IKHWAN', 'AKHWAT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "gender" "Gender" NOT NULL DEFAULT 'IKHWAN';

-- AlterTable
ALTER TABLE "Group" ADD COLUMN "gender" "Gender" NOT NULL DEFAULT 'IKHWAN';

-- AlterTable
ALTER TABLE "UserInvitation" ADD COLUMN "gender" "Gender";
