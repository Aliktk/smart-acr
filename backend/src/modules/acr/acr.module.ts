import { Module } from "@nestjs/common";
import { WorkflowModule } from "../workflow/workflow.module";
import { AcrController } from "./acr.controller";
import { AcrService } from "./acr.service";

@Module({
  imports: [WorkflowModule],
  controllers: [AcrController],
  providers: [AcrService],
})
export class AcrModule {}
