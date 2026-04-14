import { Module } from "@nestjs/common";
import { AuthorityMatrixController } from "./authority-matrix.controller";
import { AuthorityMatrixService } from "./authority-matrix.service";

@Module({
  controllers: [AuthorityMatrixController],
  providers: [AuthorityMatrixService],
  exports: [AuthorityMatrixService],
})
export class AuthorityMatrixModule {}
