import { ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { buildScopedOrgWhere, canViewOrganization, loadScopedUser } from "../../helpers/security.utils";

const FULL_ORGANIZATION_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.IT_OPS,
  UserRole.SECRET_BRANCH,
  UserRole.DG,
  UserRole.EXECUTIVE_VIEWER,
];

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async masterData(userId: string, activeRole: UserRole) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    if (!canViewOrganization(user)) {
      throw new ForbiddenException("The current role cannot access organization master data.");
    }

    const [wings, directorates, regions, zones, circles, stations, branches, cells, offices, departments] = await Promise.all([
      this.prisma.wing.findMany({ orderBy: { name: "asc" } }),
      this.prisma.directorate.findMany({ orderBy: { name: "asc" } }),
      this.prisma.region.findMany({ orderBy: { name: "asc" } }),
      this.prisma.zone.findMany({ orderBy: { name: "asc" } }),
      this.prisma.circle.findMany({ orderBy: { name: "asc" } }),
      this.prisma.station.findMany({ orderBy: { name: "asc" } }),
      this.prisma.branch.findMany({ orderBy: { name: "asc" } }),
      this.prisma.cell.findMany({ orderBy: { name: "asc" } }),
      this.prisma.office.findMany({ orderBy: { name: "asc" } }),
      this.prisma.department.findMany({ orderBy: { name: "asc" } }),
    ]);

    return {
      wings,
      directorates,
      regions,
      zones,
      circles,
      stations,
      branches,
      cells,
      offices,
      departments,
    };
  }

  async summary(userId: string, activeRole: UserRole) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    if (!canViewOrganization(user)) {
      throw new ForbiddenException("The current role cannot access organization summary data.");
    }

    const [wings, regions] = await Promise.all([
      this.prisma.wing.findMany({
        include: {
          zones: {
            include: {
              offices: {
                where: {
                  scopeTrack: "WING",
                },
                include: {
                  _count: { select: { employees: true, users: true } },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      this.prisma.region.findMany({
        include: {
          zones: {
            include: {
              offices: {
                where: {
                  scopeTrack: "REGIONAL",
                },
                include: {
                  _count: { select: { employees: true, users: true } },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    const scopedWhere = FULL_ORGANIZATION_ROLES.includes(user.activeRole) ? null : buildScopedOrgWhere(user);
    const canSeeOffice = (office: { wingId?: string | null; regionId?: string | null; zoneId?: string | null; officeId?: string | null; id: string }) => {
      if (!scopedWhere) {
        return true;
      }

      const [field, value] = Object.entries(scopedWhere)[0] ?? [];
      if (!field || !value) {
        return true;
      }

      return office[field as keyof typeof office] === value || (field === "officeId" && office.id === value);
    };

    const wingEntries = wings
      .map((wing) => ({
        id: wing.id,
        name: wing.name,
        code: wing.code,
        track: "WING" as const,
        zones: wing.zones
          .map((zone) => ({
            id: zone.id,
            name: zone.name,
            code: zone.code,
            offices: zone.offices
              .filter((office) => canSeeOffice({ ...office, officeId: office.id }))
              .map((office) => ({
                id: office.id,
                name: office.name,
                code: office.code,
                employeeCount: office._count.employees,
                userCount: office._count.users,
              })),
          }))
          .filter((zone) => zone.offices.length > 0 || FULL_ORGANIZATION_ROLES.includes(user.activeRole)),
      }))
      .filter((wing) => wing.zones.length > 0);

    const regionEntries = regions
      .map((region) => ({
        id: region.id,
        name: region.name,
        code: region.code,
        track: "REGIONAL" as const,
        zones: region.zones
          .map((zone) => ({
            id: zone.id,
            name: zone.name,
            code: zone.code,
            offices: zone.offices
              .filter((office) => canSeeOffice({ ...office, officeId: office.id }))
              .map((office) => ({
                id: office.id,
                name: office.name,
                code: office.code,
                employeeCount: office._count.employees,
                userCount: office._count.users,
              })),
          }))
          .filter((zone) => zone.offices.length > 0 || FULL_ORGANIZATION_ROLES.includes(user.activeRole)),
      }))
      .filter((region) => region.zones.length > 0);

    return [...regionEntries, ...wingEntries];
  }
}
