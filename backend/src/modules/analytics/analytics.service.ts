import { ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { canAccessAcr, canAccessEmployee, canViewAnalytics, loadScopedUser } from "../../helpers/security.utils";

const FULL_ANALYTICS_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.IT_OPS,
  UserRole.SECRET_BRANCH,
  UserRole.DG,
  UserRole.EXECUTIVE_VIEWER,
];

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async leadership(userId: string, activeRole: UserRole) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    if (!canViewAnalytics(user)) {
      throw new ForbiddenException("The current role cannot access leadership analytics.");
    }

    const wings = await this.prisma.wing.findMany({
      include: {
        employees: true,
        offices: true,
      },
      orderBy: { name: "asc" },
    });
    const acrs = await this.prisma.acrRecord.findMany({
      include: {
        employee: {
          select: {
            wingId: true,
            zoneId: true,
            officeId: true,
            reportingOfficerId: true,
            countersigningOfficerId: true,
            userId: true,
            id: true,
          },
        },
      },
    });

    const visibleAcrs = acrs.filter((acr) => canAccessAcr(user, acr));
    const visibleWingIds = new Set(
      wings
        .filter((wing) => {
          if (FULL_ANALYTICS_ROLES.includes(user.activeRole)) {
            return true;
          }

          if (user.activeRole === UserRole.WING_OVERSIGHT) {
            return wing.id === (user.activeAssignment?.wingId ?? user.wingId);
          }

          if (user.activeRole === UserRole.ZONAL_OVERSIGHT) {
            const zoneId = user.activeAssignment?.zoneId ?? user.zoneId;
            return wing.offices.some((office) => office.zoneId === zoneId);
          }

          return false;
        })
        .map((wing) => wing.id),
    );

    return {
      wingWiseTrends: wings
        .filter((wing) => visibleWingIds.has(wing.id))
        .map((wing) => ({
          name: wing.name,
          employees: wing.employees.filter((employee) => canAccessEmployee(user, employee)).length,
          offices: wing.offices.filter((office) => {
            if (FULL_ANALYTICS_ROLES.includes(user.activeRole)) {
              return true;
            }

            if (user.activeRole === UserRole.WING_OVERSIGHT) {
              return office.wingId === (user.activeAssignment?.wingId ?? user.wingId);
            }

            if (user.activeRole === UserRole.ZONAL_OVERSIGHT) {
              return office.zoneId === (user.activeAssignment?.zoneId ?? user.zoneId);
            }

            return false;
          }).length,
          acrCount: visibleAcrs.filter((acr) => acr.employee.wingId === wing.id).length,
        }))
        .filter((entry) => entry.employees > 0 || entry.offices > 0 || entry.acrCount > 0),
      backlogDistribution: wings
        .filter((wing) => visibleWingIds.has(wing.id))
        .map((wing) => ({
          name: wing.name,
          pending: visibleAcrs.filter((acr) => acr.employee.wingId === wing.id && acr.workflowState !== "ARCHIVED").length,
        }))
        .filter((entry) => entry.pending > 0 || visibleWingIds.size === 1),
    };
  }
}
