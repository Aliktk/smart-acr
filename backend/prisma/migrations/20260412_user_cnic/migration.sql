-- AddColumn: cnic on User (optional, unique)
-- Allows users to be looked up by CNIC during login and account management.

ALTER TABLE "User" ADD COLUMN "cnic" TEXT;
CREATE UNIQUE INDEX "User_cnic_key" ON "User"("cnic") WHERE "cnic" IS NOT NULL;
