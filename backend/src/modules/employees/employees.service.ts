import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { TemplateFamilyCode, UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { canCreateEmployeeRecord, loadScopedUser } from "../../helpers/security.utils";
import { mapEmployee } from "../../helpers/view-mappers";
import { CreateEmployeeDto } from "./dto/create-employee.dto";

type ScopedUser = Awaited<ReturnType<typeof loadScopedUser>>;
type OfficeWithOrg = Prisma.OfficeGetPayload<{
  include: {
    wing: {
      select: {
        name: true;
      };
    };
    zone: {
      select: {
        name: true;
      };
    };
  };
}>;
type RoleAssignmentWithUser = Prisma.UserRoleAssignmentGetPayload<{
  include: {
    user: {
      include: {
        office: {
          select: {
            name: true;
          };
        };
        zone: {
          select: {
            name: true;
          };
        };
        wing: {
          select: {
            name: true;
          };
        };
      };
    };
    office: {
      select: {
        name: true;
      };
    };
    zone: {
      select: {
        name: true;
      };
    };
    wing: {
      select: {
        name: true;
      };
    };
  };
}>;

type ManualCreationScope = {
  offices: OfficeWithOrg[];
  officeIds: string[];
  zoneIds: string[];
  wingIds: string[];
};

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, activeRole: UserRole, query?: string) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    const trimmedQuery = query?.trim();
    const where: Prisma.EmployeeWhereInput = {
      AND: [
        this.buildEmployeeScopeWhere(user),
        trimmedQuery
          ? {
              OR: [
                { name: { contains: trimmedQuery, mode: "insensitive" } },
                { cnic: { contains: trimmedQuery } },
                { mobile: { contains: trimmedQuery } },
                { rank: { contains: trimmedQuery, mode: "insensitive" } },
                { designation: { contains: trimmedQuery, mode: "insensitive" } },
                { posting: { contains: trimmedQuery, mode: "insensitive" } },
                { email: { contains: trimmedQuery, mode: "insensitive" } },
                { serviceNumber: { contains: trimmedQuery, mode: "insensitive" } },
                { office: { name: { contains: trimmedQuery, mode: "insensitive" } } },
                { wing: { name: { contains: trimmedQuery, mode: "insensitive" } } },
                { zone: { name: { contains: trimmedQuery, mode: "insensitive" } } },
                { reportingOfficer: { displayName: { contains: trimmedQuery, mode: "insensitive" } } },
                { countersigningOfficer: { displayName: { contains: trimmedQuery, mode: "insensitive" } } },
              ],
            }
          : {},
      ],
    };

    const employees = await this.prisma.employee.findMany({
      where,
      include: {
        wing: true,
        zone: true,
        office: true,
        reportingOfficer: {
          include: {
            employeeProfiles: {
              select: {
                designation: true,
              },
            },
          },
        },
        countersigningOfficer: {
          include: {
            employeeProfiles: {
              select: {
                designation: true,
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
      take: 50,
    });

    return {
      items: employees.map((employee) => mapEmployee(employee)),
      total: employees.length,
    };
  }

  private buildEmployeeScopeWhere(user: ScopedUser): Prisma.EmployeeWhereInput {
    if (
      user.activeRole === UserRole.SUPER_ADMIN ||
      user.activeRole === UserRole.IT_OPS ||
      user.activeRole === UserRole.SECRET_BRANCH ||
      user.activeRole === UserRole.DG ||
      user.activeRole === UserRole.EXECUTIVE_VIEWER
    ) {
      return {};
    }

    if (user.activeRole === UserRole.WING_OVERSIGHT && user.activeAssignment?.wingId) {
      return { wingId: user.activeAssignment.wingId };
    }

    if (user.activeRole === UserRole.ZONAL_OVERSIGHT && user.activeAssignment?.zoneId) {
      return { zoneId: user.activeAssignment.zoneId };
    }

    if (user.activeRole === UserRole.CLERK) {
      const officeId = user.activeAssignment?.officeId ?? user.officeId;
      return officeId ? { officeId } : { id: "__no_access__" };
    }

    if (user.activeRole === UserRole.REPORTING_OFFICER) {
      return { reportingOfficerId: user.id };
    }

    if (user.activeRole === UserRole.COUNTERSIGNING_OFFICER) {
      return { countersigningOfficerId: user.id };
    }

    if (user.activeRole === UserRole.EMPLOYEE) {
      const employeeIds = user.employeeProfiles.map((profile) => profile.id);
      return employeeIds.length > 0 ? { id: { in: employeeIds } } : { id: "__no_access__" };
    }

    return {};
  }

  async manualOptions(userId: string, activeRole: UserRole, officeId?: string) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);

    if (!canCreateEmployeeRecord(user)) {
      throw new ForbiddenException("Only clerks or system administrators can add new employee records.");
    }

    const scope = await this.resolveManualCreationScope(user);
    const selectedOffice = officeId ? this.requireAccessibleOffice(scope, officeId) : null;

    return {
      offices: scope.offices.map((office) => ({
        id: office.id,
        name: office.name,
        code: office.code,
        zoneName: office.zone.name,
        wingName: office.wing.name,
      })),
      reportingOfficers: await this.listAssignableOfficers(UserRole.REPORTING_OFFICER, scope, selectedOffice),
      countersigningOfficers: await this.listAssignableOfficers(UserRole.COUNTERSIGNING_OFFICER, scope, selectedOffice),
    };
  }

  async create(userId: string, activeRole: UserRole, dto: CreateEmployeeDto) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);

    if (!canCreateEmployeeRecord(user)) {
      throw new ForbiddenException("Only clerks or system administrators can add new employee records.");
    }

    const scope = await this.resolveManualCreationScope(user);
    const office = this.requireAccessibleOffice(scope, dto.officeId);
    const reportingOfficer = await this.requireAssignableOfficer(dto.reportingOfficerId, UserRole.REPORTING_OFFICER, office);
    const countersigningOfficer = this.requiresCountersigning(dto.templateFamily)
      ? await this.requireCountersigningOfficer(dto, office)
      : null;
    const normalizedCnic = this.normalizeCnic(dto.cnic);
    const normalizedEmail = dto.email?.trim().toLowerCase() ?? this.defaultEmailFor(dto.name);

    const existingEmployee = await this.prisma.employee.findUnique({
      where: { cnic: normalizedCnic },
      select: {
        id: true,
        name: true,
        serviceNumber: true,
      },
    });

    if (existingEmployee) {
      throw new ConflictException(
        `An employee record already exists for CNIC ${normalizedCnic} under ${existingEmployee.name} (${existingEmployee.serviceNumber}).`,
      );
    }

    try {
      const serviceNumber = await this.nextServiceNumber();
      const employee = await this.prisma.employee.create({
        data: {
          serviceNumber,
          name: dto.name.trim(),
          rank: dto.rank.trim(),
          designation: dto.designation.trim(),
          bps: dto.bps,
          cnic: normalizedCnic,
          mobile: dto.mobile.trim(),
          email: normalizedEmail,
          posting: dto.posting.trim(),
          joiningDate: new Date(dto.joiningDate),
          serviceYears: this.calculateServiceYears(dto.joiningDate),
          address: dto.address.trim(),
          templateFamily: dto.templateFamily,
          wingId: office.wingId,
          zoneId: office.zoneId,
          officeId: office.id,
          reportingOfficerId: reportingOfficer.id,
          countersigningOfficerId: countersigningOfficer?.id ?? null,
        },
        include: {
          wing: true,
          zone: true,
          office: true,
          reportingOfficer: {
            include: {
              employeeProfiles: {
                select: {
                  designation: true,
                },
              },
            },
          },
          countersigningOfficer: {
            include: {
              employeeProfiles: {
                select: {
                  designation: true,
                },
              },
            },
          },
        },
      });

      return mapEmployee(employee);
    } catch (error) {
      this.rethrowUniqueConstraint(error, normalizedCnic);
      throw error;
    }
  }

  private async resolveManualCreationScope(user: ScopedUser) {
    const hasAdministrativeRole = user.roleAssignments.some((assignment) =>
      assignment.role === UserRole.SUPER_ADMIN || assignment.role === UserRole.IT_OPS,
    );
    const officeScopeId = user.activeAssignment?.officeId ?? user.officeId;
    const zoneScopeId = user.activeAssignment?.zoneId ?? user.zoneId;
    const wingScopeId = user.activeAssignment?.wingId ?? user.wingId;
    const officeWhere = hasAdministrativeRole
      ? undefined
      : officeScopeId
        ? { id: officeScopeId }
        : zoneScopeId
          ? { zoneId: zoneScopeId }
          : wingScopeId
            ? { wingId: wingScopeId }
            : null;

    if (officeWhere === null) {
      throw new BadRequestException("The current user does not have a valid organizational scope for manual employee entry.");
    }

    const offices = await this.prisma.office.findMany({
      where: officeWhere,
      include: {
        wing: { select: { name: true } },
        zone: { select: { name: true } },
      },
      orderBy: [{ wing: { name: "asc" } }, { zone: { name: "asc" } }, { name: "asc" }],
    });

    if (offices.length === 0) {
      throw new BadRequestException("No offices are available for the current assignment scope.");
    }

    return {
      offices,
      officeIds: offices.map((office) => office.id),
      zoneIds: Array.from(new Set(offices.map((office) => office.zoneId))),
      wingIds: Array.from(new Set(offices.map((office) => office.wingId))),
    } satisfies ManualCreationScope;
  }

  private requireAccessibleOffice(scope: ManualCreationScope, officeId: string) {
    const office = scope.offices.find((entry) => entry.id === officeId);

    if (!office) {
      throw new BadRequestException("The selected office is outside your permitted assignment scope.");
    }

    return office;
  }

  private requiresCountersigning(templateFamily: TemplateFamilyCode) {
    return templateFamily !== TemplateFamilyCode.APS_STENOTYPIST;
  }

  private async requireCountersigningOfficer(dto: CreateEmployeeDto, office: OfficeWithOrg) {
    if (!dto.countersigningOfficerId) {
      throw new BadRequestException("A countersigning officer is required for the selected form family.");
    }

    return this.requireAssignableOfficer(dto.countersigningOfficerId, UserRole.COUNTERSIGNING_OFFICER, office);
  }

  private async requireAssignableOfficer(userId: string, role: UserRole, office: OfficeWithOrg) {
    const assignment = await this.prisma.userRoleAssignment.findFirst({
      where: {
        userId,
        role,
        OR: [{ officeId: office.id }, { zoneId: office.zoneId }, { wingId: office.wingId }],
      },
      include: {
        user: true,
      },
      orderBy: [{ officeId: "desc" }, { zoneId: "desc" }, { wingId: "desc" }],
    });

    if (!assignment?.user) {
      throw new BadRequestException(`The selected ${this.roleLabel(role)} is not assigned to the chosen office scope.`);
    }

    return assignment.user;
  }

  private async listAssignableOfficers(role: UserRole, scope: ManualCreationScope, selectedOffice: OfficeWithOrg | null) {
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: {
        role,
        OR: selectedOffice
          ? [{ officeId: selectedOffice.id }, { zoneId: selectedOffice.zoneId }, { wingId: selectedOffice.wingId }]
          : this.buildRoleScopeFilter(scope),
      },
      include: {
        user: {
          include: {
            office: { select: { name: true } },
            zone: { select: { name: true } },
            wing: { select: { name: true } },
          },
        },
        office: { select: { name: true } },
        zone: { select: { name: true } },
        wing: { select: { name: true } },
      },
    });

    const deduped = new Map<string, RoleAssignmentWithUser>();

    for (const assignment of assignments) {
      const existing = deduped.get(assignment.userId);

      if (!existing || this.assignmentSpecificity(assignment) > this.assignmentSpecificity(existing)) {
        deduped.set(assignment.userId, assignment);
      }
    }

    return Array.from(deduped.values())
      .sort((left, right) => left.user.displayName.localeCompare(right.user.displayName))
      .map((assignment) => ({
        id: assignment.userId,
        displayName: assignment.user.displayName,
        badgeNo: assignment.user.badgeNo,
        officeName: assignment.user.office?.name ?? assignment.office?.name ?? null,
        zoneName: assignment.user.zone?.name ?? assignment.zone?.name ?? null,
        wingName: assignment.user.wing?.name ?? assignment.wing?.name ?? null,
        scopeLabel: this.scopeLabelForAssignment(assignment),
      }));
  }

  private buildRoleScopeFilter(scope: ManualCreationScope) {
    const filters: Prisma.UserRoleAssignmentWhereInput[] = [];

    if (scope.officeIds.length > 0) {
      filters.push({ officeId: { in: scope.officeIds } });
    }

    if (scope.zoneIds.length > 0) {
      filters.push({ zoneId: { in: scope.zoneIds } });
    }

    if (scope.wingIds.length > 0) {
      filters.push({ wingId: { in: scope.wingIds } });
    }

    return filters;
  }

  private assignmentSpecificity(assignment: RoleAssignmentWithUser) {
    if (assignment.officeId) {
      return 3;
    }

    if (assignment.zoneId) {
      return 2;
    }

    if (assignment.wingId) {
      return 1;
    }

    return 0;
  }

  private scopeLabelForAssignment(assignment: RoleAssignmentWithUser) {
    if (assignment.office?.name) {
      return assignment.office.name;
    }

    if (assignment.zone?.name) {
      return assignment.zone.name;
    }

    if (assignment.wing?.name) {
      return assignment.wing.name;
    }

    if (assignment.user.office?.name) {
      return assignment.user.office.name;
    }

    if (assignment.user.zone?.name) {
      return assignment.user.zone.name;
    }

    if (assignment.user.wing?.name) {
      return assignment.user.wing.name;
    }

    return "FIA";
  }

  private roleLabel(role: UserRole) {
    return role === UserRole.REPORTING_OFFICER ? "reporting officer" : "countersigning officer";
  }

  private calculateServiceYears(joiningDate: string) {
    const joinedAt = new Date(joiningDate);
    const diff = Date.now() - joinedAt.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
  }

  private async nextServiceNumber() {
    const employees = await this.prisma.employee.findMany({
      select: {
        serviceNumber: true,
      },
    });
    const maxSequence = employees.reduce((maxValue, employee) => {
      const match = /^EMP-(\d+)$/.exec(employee.serviceNumber);
      if (!match) {
        return maxValue;
      }

      return Math.max(maxValue, Number(match[1]));
    }, 0);

    return `EMP-${String(maxSequence + 1).padStart(3, "0")}`;
  }

  private normalizeCnic(cnic: string) {
    const digitsOnly = cnic.replace(/\D/g, "");
    if (digitsOnly.length === 13) {
      return `${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5, 12)}-${digitsOnly.slice(12)}`;
    }

    return cnic.trim();
  }

  private rethrowUniqueConstraint(error: unknown, cnic: string): never | void {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new ConflictException(`An employee record already exists for CNIC ${cnic}.`);
    }
  }

  private defaultEmailFor(name: string) {
    return `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/(^\.|\.$)/g, "")}@fia.gov.pk`;
  }
}
