-- CreateEnum
CREATE TYPE "AuthChallengePurpose" AS ENUM ('LOGIN');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "activeRole" "UserRole",
ADD COLUMN     "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Session" AS "s"
SET "activeRole" = COALESCE(
    (
        SELECT "ura"."role"
        FROM "UserRoleAssignment" AS "ura"
        WHERE "ura"."userId" = "s"."userId"
        ORDER BY "ura"."createdAt" ASC
        LIMIT 1
    ),
    'CLERK'::"UserRole"
)
WHERE "s"."activeRole" IS NULL;

ALTER TABLE "Session" ALTER COLUMN "activeRole" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mobileNumber" TEXT,
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AuthChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "AuthChallengePurpose" NOT NULL DEFAULT 'LOGIN',
    "codeHash" TEXT NOT NULL,
    "maskedDestination" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthChallenge_userId_expiresAt_idx" ON "AuthChallenge"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthChallenge_expiresAt_consumedAt_idx" ON "AuthChallenge"("expiresAt", "consumedAt");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_expiresAt_idx" ON "Session"("userId", "revokedAt", "expiresAt");

-- AddForeignKey
ALTER TABLE "AuthChallenge" ADD CONSTRAINT "AuthChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
