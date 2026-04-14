import { Module } from "@nestjs/common";
import { EmployeesController } from "./employees.controller";
import { EmployeePortalController } from "./employee-portal.controller";
import { EmployeesService } from "./employees.service";
import { AcrModule } from "../acr/acr.module";

@Module({
  imports: [AcrModule],
  controllers: [EmployeesController, EmployeePortalController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
