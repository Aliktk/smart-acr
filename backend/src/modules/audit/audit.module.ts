import { Global, Module } from "@nestjs/common";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";
import { AuditWriterService } from "./audit-writer.service";

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditWriterService],
  exports: [AuditWriterService],
})
export class AuditModule {}
