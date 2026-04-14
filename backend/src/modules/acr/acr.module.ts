import { Module } from "@nestjs/common";
import { UserAssetsModule } from "../user-assets/user-assets.module";
import { WorkflowModule } from "../workflow/workflow.module";
import { AcrController } from "./acr.controller";
import { AcrService } from "./acr.service";

@Module({
  imports: [WorkflowModule, UserAssetsModule],
  controllers: [AcrController],
  providers: [AcrService],
  exports: [AcrService],
})
export class AcrModule {}
