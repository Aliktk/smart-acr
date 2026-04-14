-- AddColumn Employee.spouseName
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "spouseName" TEXT;
