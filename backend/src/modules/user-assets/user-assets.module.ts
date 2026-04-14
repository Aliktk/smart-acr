import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { UserAssetsController } from "./user-assets.controller";
import { UserAssetsService } from "./user-assets.service";

@Module({
  imports: [StorageModule],
  controllers: [UserAssetsController],
  providers: [UserAssetsService],
  exports: [UserAssetsService],
})
export class UserAssetsModule {}
