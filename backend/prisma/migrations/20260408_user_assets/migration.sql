DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserAssetType') THEN
    CREATE TYPE "UserAssetType" AS ENUM ('SIGNATURE', 'STAMP');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FileStorageType') THEN
    CREATE TYPE "FileStorageType" AS ENUM ('LOCAL');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "UserAsset" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assetType" "UserAssetType" NOT NULL,
  "storageType" "FileStorageType" NOT NULL DEFAULT 'LOCAL',
  "filePath" TEXT NOT NULL,
  "fileUrl" TEXT,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserAsset_userId_assetType_isActive_idx" ON "UserAsset"("userId", "assetType", "isActive");
CREATE INDEX IF NOT EXISTS "UserAsset_updatedAt_idx" ON "UserAsset"("updatedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'UserAsset_userId_fkey'
      AND table_name = 'UserAsset'
  ) THEN
    ALTER TABLE "UserAsset"
      ADD CONSTRAINT "UserAsset_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
