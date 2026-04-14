import type { Prisma } from "@prisma/client";
import { UserAssetType } from "@prisma/client";

export const ACTIVE_USER_ASSET_SELECT = {
  id: true,
  assetType: true,
  storageType: true,
  originalName: true,
  mimeType: true,
  fileSize: true,
  updatedAt: true,
  isActive: true,
} satisfies Prisma.UserAssetSelect;

export type ActiveUserAssetRecord = Prisma.UserAssetGetPayload<{
  select: typeof ACTIVE_USER_ASSET_SELECT;
}>;

export function mapUserAssetSummary(asset: ActiveUserAssetRecord | null | undefined) {
  if (!asset || !asset.isActive) {
    return null;
  }

  return {
    id: asset.id,
    assetType: asset.assetType,
    storageType: asset.storageType,
    fileName: asset.originalName,
    mimeType: asset.mimeType,
    fileSize: asset.fileSize,
    updatedAt: asset.updatedAt.toISOString(),
  };
}

export function groupUserAssets(assets: ActiveUserAssetRecord[] | null | undefined) {
  const signature = assets?.find((asset) => asset.assetType === UserAssetType.SIGNATURE && asset.isActive);
  const stamp = assets?.find((asset) => asset.assetType === UserAssetType.STAMP && asset.isActive);

  return {
    signature: mapUserAssetSummary(signature),
    stamp: mapUserAssetSummary(stamp),
  };
}
