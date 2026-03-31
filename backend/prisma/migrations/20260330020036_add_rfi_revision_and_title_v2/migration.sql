/*
  Warnings:

  - You are about to drop the column `leadTimeDays` on the `materials` table. All the data in the column will be lost.
  - You are about to drop the column `durationDays` on the `projects` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[projectId,rfiNumber,revisionNumber]` on the table `rfis` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[projectId,submittalNumber,revisionNumber]` on the table `submittals` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `durationMonths` to the `projects` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "rfis_projectId_rfiNumber_key";

-- DropIndex
DROP INDEX "submittals_projectId_submittalNumber_key";

-- AlterTable
ALTER TABLE "materials" DROP COLUMN "leadTimeDays",
ADD COLUMN     "leadTimeWeeks" INTEGER,
ALTER COLUMN "poId" DROP NOT NULL,
ALTER COLUMN "vendorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "durationDays",
ADD COLUMN     "durationMonths" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "rfis" ADD COLUMN     "parentRfiId" TEXT,
ADD COLUMN     "revisionNumber" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "title" TEXT NOT NULL DEFAULT 'Untitled RFI';

-- AlterTable
ALTER TABLE "submittals" ADD COLUMN     "reviewDurationDays" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "rfis_projectId_rfiNumber_revisionNumber_key" ON "rfis"("projectId", "rfiNumber", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "submittals_projectId_submittalNumber_revisionNumber_key" ON "submittals"("projectId", "submittalNumber", "revisionNumber");

-- AddForeignKey
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_parentRfiId_fkey" FOREIGN KEY ("parentRfiId") REFERENCES "rfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
