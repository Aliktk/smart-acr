import { Module } from "@nestjs/common";
import { AdverseRemarksController } from "./adverse-remarks.controller";
import { AdverseRemarksService } from "./adverse-remarks.service";

@Module({
  controllers: [AdverseRemarksController],
  providers: [AdverseRemarksService],
  exports: [AdverseRemarksService],
})
export class AdverseRemarksModule {}
