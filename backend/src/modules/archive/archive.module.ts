import { Module } from "@nestjs/common";
import { ArchiveController } from "./archive.controller";
import { ArchiveService } from "./archive.service";
import { WorkflowModule } from "../workflow/workflow.module";
import { FilesModule } from "../files/files.module";

@Module({
  imports: [WorkflowModule, FilesModule],
  controllers: [ArchiveController],
  providers: [ArchiveService],
})
export class ArchiveModule {}
