import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./common/prisma.module";
import { validateEnv } from "./config/env";
import { AuthModule } from "./modules/auth/auth.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { AcrModule } from "./modules/acr/acr.module";
import { EmployeesModule } from "./modules/employees/employees.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AuditModule } from "./modules/audit/audit.module";
import { OrganizationModule } from "./modules/organization/organization.module";
import { TemplatesModule } from "./modules/templates/templates.module";
import { ArchiveModule } from "./modules/archive/archive.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { FilesModule } from "./modules/files/files.module";
import { WorkflowModule } from "./modules/workflow/workflow.module";
import { HealthModule } from "./modules/health/health.module";
import { UsersModule } from "./modules/users/users.module";
import { UserAssetsModule } from "./modules/user-assets/user-assets.module";
import { AdverseRemarksModule } from "./modules/adverse-remarks/adverse-remarks.module";
import { AuthorityMatrixModule } from "./modules/authority-matrix/authority-matrix.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    JwtModule.register({ global: true }),
    ThrottlerModule.forRoot([
      { name: "short", ttl: 1000, limit: 5 },
      { name: "medium", ttl: 60000, limit: 30 },
    ]),
    PrismaModule,
    AuthModule,
    DashboardModule,
    AcrModule,
    EmployeesModule,
    NotificationsModule,
    AuditModule,
    OrganizationModule,
    TemplatesModule,
    ArchiveModule,
    SettingsModule,
    AnalyticsModule,
    FilesModule,
    WorkflowModule,
    HealthModule,
    UsersModule,
    UserAssetsModule,
    AdverseRemarksModule,
    AuthorityMatrixModule,
  ],
})
export class AppModule {}
