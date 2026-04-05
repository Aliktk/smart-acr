import { Module } from "@nestjs/common";
import { ArchiveController } from "./archive.controller";
import { ArchiveService } from "./archive.service";
import { WorkflowModule } from "../workflow/workflow.module";

@Module({
  imports: [WorkflowModule],
  controllers: [ArchiveController],
  providers: [ArchiveService],
})
export class ArchiveModule {}
