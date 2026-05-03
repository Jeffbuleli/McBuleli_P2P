-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'TREASURY', 'AGENT');

-- CreateTable
CREATE TABLE "UserStaffRole" (
    "userId" UUID NOT NULL,
    "role" "StaffRole" NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByUserId" UUID,

    CONSTRAINT "UserStaffRole_pkey" PRIMARY KEY ("userId","role")
);

-- CreateIndex
CREATE INDEX "UserStaffRole_role_idx" ON "UserStaffRole"("role");

-- AddForeignKey
ALTER TABLE "UserStaffRole" ADD CONSTRAINT "UserStaffRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStaffRole" ADD CONSTRAINT "UserStaffRole_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
