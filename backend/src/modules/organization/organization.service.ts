import { ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { canViewOrganization, loadScopedUser } from "../../helpers/security.utils";

const FULL_ORGANIZATION_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.IT_OPS,
  UserRole.SECRET_BRANCH,
  UserRole.DG,
  UserRole.EXECUTIVE_VIEWER,
];

const WING_LEVEL_ORGANIZATION_ROLES: UserRole[] = [...FULL_ORGANIZATION_ROLES, UserRole.WING_OVERSIGHT];

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(userId: string, activeRole: UserRole) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    if (!canViewOrganization(user)) {
      throw new ForbiddenException("The current role cannot access organization summary data.");
    }

    const wings = await this.prisma.wing.findMany({
      include: {
        zones: {
          include: {
            offices: {
              include: {
                _count: { select: { employees: true, users: true } },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const wingScopeId = user.activeAssignment?.wingId ?? user.wingId;
    const zoneScopeId = user.activeAssignment?.zoneId ?? user.zoneId;

    return wings
      .filter((wing) => {
        if (FULL_ORGANIZATION_ROLES.includes(user.activeRole)) {
          return true;
        }

        if (user.activeRole === UserRole.WING_OVERSIGHT) {
          return wing.id === wingScopeId;
        }

        if (user.activeRole === UserRole.ZONAL_OVERSIGHT) {
          return wing.zones.some((zone) => zone.id === zoneScopeId);
        }

        return false;
      })
      .map((wing) => ({
        id: wing.id,
        name: wing.name,
        code: wing.code,
        zones: wing.zones
          .filter((zone) => {
            if (WING_LEVEL_ORGANIZATION_ROLES.includes(user.activeRole)) {
              return true;
            }

            if (user.activeRole === UserRole.ZONAL_OVERSIGHT) {
              return zone.id === zoneScopeId;
            }

            return false;
          })
          .map((zone) => ({
            id: zone.id,
            name: zone.name,
            code: zone.code,
            offices: zone.offices.map((office) => ({
              id: office.id,
              name: office.name,
              code: office.code,
              employeeCount: office._count.employees,
              userCount: office._count.users,
            })),
          })),
      }))
      .filter((wing) => wing.zones.length > 0);
  }
}
