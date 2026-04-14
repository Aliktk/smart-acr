import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { OrgScopeTrack, Prisma, SecretBranchDeskCode, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { canManageUsers, displayRole, loadScopedUser, type ScopedUser } from "../../helpers/security.utils";
import { inferScopeTrack, normalizeOrgScope, type NormalizedOrgScope } from "../../helpers/org-scope.utils";
import { ListUsersDto } from "./dto/list-users.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { AdminResetPasswordDto } from "./dto/admin-reset-password.dto";

const USER_INCLUDE = {
  roleAssignments: true,
  wing: true,
  directorate: true,
  region: true,
  zone: true,
  circle: true,
  station: true,
  branch: true,
  cell: true,
  office: true,
  department: true,
  secretBranchProfile: true,
} satisfies Prisma.UserInclude;

type ManagedUserRecord = Prisma.UserGetPayload<{
  include: typeof USER_INCLUDE;
}>;

type ResolvedScope = NormalizedOrgScope & {
  departmentId: string | null;
  departmentName: string | null;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actorId: string, activeRole: UserRole, query: ListUsersDto) {
    const actor = await this.requireUserAdmin(actorId, activeRole);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(10, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;
    const where = this.buildListWhere(query);

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: USER_INCLUDE,
        orderBy: [{ displayName: "asc" }, { createdAt: "desc" }],
        skip,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapManagedUser(item)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      filters: {
        activeAdmin: actor.displayName,
      },
    };
  }

  async options(actorId: string, activeRole: UserRole) {
    const actor = await this.requireUserAdmin(actorId, activeRole);

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

    const availableRoles = actor.activeRole === UserRole.SUPER_ADMIN
      ? Object.values(UserRole)
      : Object.values(UserRole).filter((role) => role !== UserRole.SUPER_ADMIN && role !== UserRole.IT_OPS);

    return {
      roles: availableRoles.map((role) => ({
        code: role,
        label: displayRole(role),
      })),
      secretBranchDeskCodes: Object.values(SecretBranchDeskCode).map((deskCode) => ({
        code: deskCode,
        label: displayRole(deskCode),
      })),
      wings: wings.map((wing) => ({ id: wing.id, name: wing.name, code: wing.code })),
      directorates: directorates.map((entry) => ({ id: entry.id, name: entry.name, code: entry.code, wingId: entry.wingId })),
      regions: regions.map((entry) => ({
        id: entry.id,
        name: entry.name,
        code: entry.code,
        wingId: entry.wingId ?? null,
        directorateId: entry.directorateId ?? null,
      })),
      zones: zones.map((entry) => ({
        id: entry.id,
        name: entry.name,
        code: entry.code,
        wingId: entry.wingId ?? null,
        regionId: entry.regionId ?? null,
      })),
      circles: circles.map((entry) => ({
        id: entry.id,
        name: entry.name,
        code: entry.code,
        wingId: entry.wingId ?? null,
        regionId: entry.regionId ?? null,
        zoneId: entry.zoneId,
      })),
      stations: stations.map((entry) => ({
        id: entry.id,
        name: entry.name,
        code: entry.code,
        wingId: entry.wingId ?? null,
        regionId: entry.regionId ?? null,
        zoneId: entry.zoneId,
        circleId: entry.circleId,
      })),
      branches: branches.map((entry) => ({
        id: entry.id,
        name: entry.name,
        code: entry.code,
        wingId: entry.wingId ?? null,
        regionId: entry.regionId ?? null,
        zoneId: entry.zoneId,
        circleId: entry.circleId,
        stationId: entry.stationId,
      })),
      cells: cells.map((entry) => ({
        id: entry.id,
        name: entry.name,
        code: entry.code,
        wingId: entry.wingId ?? null,
        regionId: entry.regionId ?? null,
        zoneId: entry.zoneId,
        circleId: entry.circleId,
        stationId: entry.stationId,
        branchId: entry.branchId,
      })),
      offices: offices.map((entry) => ({
        id: entry.id,
        name: entry.name,
        code: entry.code,
        scopeTrack: entry.scopeTrack,
        wingId: entry.wingId ?? null,
        directorateId: entry.directorateId,
        regionId: entry.regionId,
        zoneId: entry.zoneId,
        circleId: entry.circleId,
        stationId: entry.stationId,
        branchId: entry.branchId,
        cellId: entry.cellId,
      })),
      departments: departments.map((entry) => ({
        id: entry.id,
        name: entry.name,
        code: entry.code,
        officeId: entry.officeId,
      })),
    };
  }

  async detail(actorId: string, activeRole: UserRole, userId: string) {
    await this.requireUserAdmin(actorId, activeRole);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_INCLUDE,
    });

    if (!user) {
      throw new NotFoundException("The requested user account could not be found.");
    }

    const audits = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { recordType: "USER", recordId: user.id },
          { actorId: user.id },
        ],
      },
      include: {
        actor: true,
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    });

    return {
      ...this.mapManagedUser(user),
      recentAudit: audits.map((entry) => ({
        id: entry.id,
        action: entry.action,
        actorName: entry.actor?.displayName ?? "System",
        actorRole: entry.actorRole,
        details: entry.details,
        createdAt: entry.createdAt.toISOString(),
      })),
    };
  }

  async create(actorId: string, activeRole: UserRole, dto: CreateUserDto, ipAddress?: string) {
    const actor = await this.requireUserAdmin(actorId, activeRole);
    const normalized = this.normalizeUserInput(dto);
    const roles = this.uniqueRoles(normalized.roles);
    this.assertProvisioningRights(actor, roles);
    this.assertSecretBranchRoleConsistency(roles, normalized.secretBranchProfile);
    const scope = await this.resolveScope(normalized.scope);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: normalized.username,
          email: normalized.email,
          badgeNo: normalized.badgeNo,
          displayName: normalized.fullName,
          positionTitle: normalized.positionTitle,
          mobileNumber: normalized.mobileNumber,
          cnic: normalized.cnic ?? null,
          departmentName: scope.departmentName,
          departmentId: scope.departmentId,
          scopeTrack: scope.scopeTrack,
          passwordHash: await bcrypt.hash(dto.temporaryPassword, 12),
          mustChangePassword: dto.mustChangePassword ?? true,
          isActive: dto.isActive ?? true,
          wingId: scope.wingId,
          directorateId: scope.directorateId,
          regionId: scope.regionId,
          zoneId: scope.zoneId,
          circleId: scope.circleId,
          stationId: scope.stationId,
          branchId: scope.branchId,
          cellId: scope.cellId,
          officeId: scope.officeId,
          createdById: actor.id,
          updatedById: actor.id,
        },
        include: USER_INCLUDE,
      });

      await tx.userRoleAssignment.createMany({
        data: roles.map((role) => ({
          userId: user.id,
          role,
          scopeTrack: scope.scopeTrack,
          wingId: scope.wingId,
          directorateId: scope.directorateId,
          regionId: scope.regionId,
          zoneId: scope.zoneId,
          circleId: scope.circleId,
          stationId: scope.stationId,
          branchId: scope.branchId,
          cellId: scope.cellId,
          officeId: scope.officeId,
          departmentId: scope.departmentId,
        })),
      });

      await this.syncSecretBranchProfile(tx, user.id, roles, normalized.secretBranchProfile);

      // Auto-link to employee record when email matches and the employee is not yet linked
      const matchedEmployee = await tx.employee.findFirst({
        where: { email: user.email, userId: null },
        select: { id: true },
      });
      if (matchedEmployee) {
        await tx.employee.update({
          where: { id: matchedEmployee.id },
          data: { userId: user.id },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: displayRole(actor.activeRole),
          action: "User account created",
          recordType: "USER",
          recordId: user.id,
          ipAddress: ipAddress ?? "unknown",
          details: `Created user account for ${user.displayName} (${user.username}) with roles ${roles.map((role) => displayRole(role)).join(", ")}.${matchedEmployee ? " Auto-linked to matching employee record." : ""}`,
          metadata: {
            roles,
            username: user.username,
            email: user.email,
            badgeNo: user.badgeNo,
            scope,
            autoLinkedEmployeeId: matchedEmployee?.id ?? null,
          },
        },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: USER_INCLUDE,
      });
    }).catch((error: unknown) => {
      this.rethrowUniqueConstraint(error, "A user already exists with the same username, email, badge number, or CNIC.");
      throw error;
    });

    return this.mapManagedUser(created);
  }

  async update(actorId: string, activeRole: UserRole, userId: string, dto: UpdateUserDto, ipAddress?: string) {
    const actor = await this.requireUserAdmin(actorId, activeRole);
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      include: USER_INCLUDE,
    });

    if (!existing) {
      throw new NotFoundException("The requested user account could not be found.");
    }

    if (actor.id === userId && dto.roles && !dto.roles.includes(actor.activeRole)) {
      throw new BadRequestException("You cannot remove your own active administrative role from this account.");
    }

    const normalized = this.normalizeUserInput(dto);
    const existingRoles = existing.roleAssignments.map((assignment) => assignment.role);
    const scope = dto.scope ? await this.resolveScope(normalized.scope) : {
      scopeTrack: existing.scopeTrack,
      wingId: existing.wingId,
      directorateId: existing.directorateId,
      regionId: existing.regionId,
      zoneId: existing.zoneId,
      circleId: existing.circleId,
      stationId: existing.stationId,
      branchId: existing.branchId,
      cellId: existing.cellId,
      officeId: existing.officeId,
      departmentId: existing.departmentId,
      departmentName: existing.departmentName,
    };
    const roles = dto.roles ? this.uniqueRoles(dto.roles) : null;
    const nextRoles = roles ?? existingRoles;
    const effectiveSecretBranchProfile = normalized.secretBranchProfile === undefined
      ? existing.secretBranchProfile
        ? {
            deskCode: existing.secretBranchProfile.deskCode,
            canManageUsers: existing.secretBranchProfile.canManageUsers,
            canVerify: existing.secretBranchProfile.canVerify,
            isActive: existing.secretBranchProfile.isActive,
          }
        : undefined
      : normalized.secretBranchProfile;

    this.assertProvisioningRights(actor, nextRoles, existingRoles);
    this.assertSecretBranchRoleConsistency(nextRoles, effectiveSecretBranchProfile);

    if (
      actor.id === userId &&
      actor.activeRole === UserRole.SECRET_BRANCH &&
      actor.secretBranchProfile?.canManageUsers &&
      normalized.secretBranchProfile?.canManageUsers === false
    ) {
      throw new BadRequestException("You cannot remove your own Secret Branch user-management authority from the active account.");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          username: normalized.username ?? undefined,
          email: normalized.email ?? undefined,
          badgeNo: normalized.badgeNo ?? undefined,
          displayName: normalized.fullName ?? undefined,
          positionTitle: normalized.positionTitle === undefined ? undefined : normalized.positionTitle,
          mobileNumber: normalized.mobileNumber === undefined ? undefined : normalized.mobileNumber,
          cnic: normalized.cnic === undefined ? undefined : (normalized.cnic ?? null),
          departmentName: scope.departmentName,
          departmentId: scope.departmentId,
          scopeTrack: scope.scopeTrack,
          isActive: dto.isActive,
          mustChangePassword: dto.mustChangePassword,
          wingId: scope.wingId,
          directorateId: scope.directorateId,
          regionId: scope.regionId,
          zoneId: scope.zoneId,
          circleId: scope.circleId,
          stationId: scope.stationId,
          branchId: scope.branchId,
          cellId: scope.cellId,
          officeId: scope.officeId,
          updatedById: actor.id,
        },
      });

      if (roles) {
        await tx.userRoleAssignment.deleteMany({
          where: { userId },
        });
        await tx.userRoleAssignment.createMany({
          data: roles.map((role) => ({
            userId,
            role,
            scopeTrack: scope.scopeTrack,
            wingId: scope.wingId,
            directorateId: scope.directorateId,
            regionId: scope.regionId,
            zoneId: scope.zoneId,
            circleId: scope.circleId,
            stationId: scope.stationId,
            branchId: scope.branchId,
            cellId: scope.cellId,
            officeId: scope.officeId,
            departmentId: scope.departmentId,
          })),
        });
      }

      await this.syncSecretBranchProfile(
        tx,
        userId,
        roles ?? existing.roleAssignments.map((assignment) => assignment.role),
        normalized.secretBranchProfile,
      );

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: displayRole(actor.activeRole),
          action: roles ? "User account updated / role changed" : "User account updated",
          recordType: "USER",
          recordId: userId,
          ipAddress: ipAddress ?? "unknown",
          details: `Updated user account for ${user.displayName}.`,
          metadata: {
            roles: roles ?? existing.roleAssignments.map((assignment) => assignment.role),
            status: dto.isActive ?? existing.isActive,
            scope,
          },
        },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: USER_INCLUDE,
      });
    }).catch((error: unknown) => {
      this.rethrowUniqueConstraint(error, "A user already exists with the same username, email, badge number, or CNIC.");
      throw error;
    });

    return this.mapManagedUser(updated);
  }

  async resetPassword(actorId: string, activeRole: UserRole, userId: string, dto: AdminResetPasswordDto, ipAddress?: string) {
    const actor = await this.requireUserAdmin(actorId, activeRole);

    if (actor.id === userId) {
      throw new BadRequestException("Use the personal password change flow to update your own password.");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        roleAssignments: {
          select: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("The requested user account could not be found.");
    }

    this.assertProvisioningRights(actor, user.roleAssignments.map((assignment) => assignment.role), user.roleAssignments.map((assignment) => assignment.role));

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: await bcrypt.hash(dto.nextPassword, 12),
          passwordChangedAt: new Date(),
          mustChangePassword: dto.mustChangePassword ?? true,
          updatedById: actor.id,
        },
      }),
      this.prisma.passwordResetToken.deleteMany({
        where: { userId },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: displayRole(actor.activeRole),
          action: "Admin password reset",
          recordType: "USER",
          recordId: userId,
          ipAddress: ipAddress ?? "unknown",
          details: `Administrative password reset completed for ${user.displayName}.`,
          metadata: {
            mustChangePassword: dto.mustChangePassword ?? true,
          },
        },
      }),
    ]);

    return {
      success: true,
      message: "Password reset successfully.",
    };
  }

  async deactivate(actorId: string, activeRole: UserRole, userId: string, ipAddress?: string) {
    return this.setUserActiveState(actorId, activeRole, userId, false, ipAddress);
  }

  async reactivate(actorId: string, activeRole: UserRole, userId: string, ipAddress?: string) {
    return this.setUserActiveState(actorId, activeRole, userId, true, ipAddress);
  }

  private async setUserActiveState(
    actorId: string,
    activeRole: UserRole,
    userId: string,
    isActive: boolean,
    ipAddress?: string,
  ) {
    const actor = await this.requireUserAdmin(actorId, activeRole);

    if (actor.id === userId && !isActive) {
      throw new BadRequestException("You cannot deactivate your own administrative account.");
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        isActive: true,
        roleAssignments: {
          select: {
            role: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException("The requested user account could not be found.");
    }

    this.assertProvisioningRights(actor, existing.roleAssignments.map((assignment) => assignment.role), existing.roleAssignments.map((assignment) => assignment.role));

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          isActive,
          updatedById: actor.id,
        },
      }),
      ...(isActive
        ? []
        : [
            this.prisma.session.updateMany({
              where: {
                userId,
                revokedAt: null,
              },
              data: {
                revokedAt: new Date(),
              },
            }),
          ]),
      this.prisma.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: displayRole(actor.activeRole),
          action: isActive ? "User account reactivated" : "User account deactivated",
          recordType: "USER",
          recordId: userId,
          ipAddress: ipAddress ?? "unknown",
          details: `${isActive ? "Reactivated" : "Deactivated"} user account for ${existing.displayName}.`,
          metadata: {
            status: isActive ? "active" : "inactive",
          },
        },
      }),
    ]);

    const updated = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: USER_INCLUDE,
    });

    return this.mapManagedUser(updated);
  }

  private async requireUserAdmin(userId: string, activeRole: UserRole) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    if (!canManageUsers(user)) {
      throw new ForbiddenException("The current role cannot manage user accounts.");
    }
    return user;
  }

  private buildListWhere(query: ListUsersDto): Prisma.UserWhereInput {
    const and: Prisma.UserWhereInput[] = [];
    const normalizedQuery = query.query?.trim();

    if (normalizedQuery) {
      and.push({
        OR: [
          { displayName: { contains: normalizedQuery, mode: "insensitive" } },
          { username: { contains: normalizedQuery, mode: "insensitive" } },
          { email: { contains: normalizedQuery, mode: "insensitive" } },
          { badgeNo: { contains: normalizedQuery, mode: "insensitive" } },
          { positionTitle: { contains: normalizedQuery, mode: "insensitive" } },
        ],
      });
    }

    if (query.role) {
      and.push({
        roleAssignments: {
          some: {
            role: query.role,
          },
        },
      });
    }

    if (query.status) {
      and.push({
        isActive: query.status === "active",
      });
    }

    if (query.scopeTrack) {
      and.push({ scopeTrack: query.scopeTrack });
    }

    if (query.wingId) {
      and.push({ wingId: query.wingId });
    }

    if (query.directorateId) {
      and.push({ directorateId: query.directorateId });
    }

    if (query.regionId) {
      and.push({ regionId: query.regionId });
    }

    if (query.zoneId) {
      and.push({ zoneId: query.zoneId });
    }

    if (query.circleId) {
      and.push({ circleId: query.circleId });
    }

    if (query.stationId) {
      and.push({ stationId: query.stationId });
    }

    if (query.branchId) {
      and.push({ branchId: query.branchId });
    }

    if (query.cellId) {
      and.push({ cellId: query.cellId });
    }

    if (query.officeId) {
      and.push({ officeId: query.officeId });
    }

    if (query.departmentId) {
      and.push({ departmentId: query.departmentId });
    }

    return and.length > 0 ? { AND: and } : {};
  }

  private uniqueRoles(roles: UserRole[]) {
    return Array.from(new Set(roles));
  }

  private assertProvisioningRights(actor: ScopedUser, nextRoles: UserRole[], existingRoles: UserRole[] = []) {
    if (actor.activeRole === UserRole.SUPER_ADMIN) {
      return;
    }

    const protectedRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.IT_OPS];
    const requestedProtectedRoles = nextRoles.filter((role) => protectedRoles.includes(role));
    const existingProtectedRoles = existingRoles.filter((role) => protectedRoles.includes(role));

    if (requestedProtectedRoles.length > 0 || existingProtectedRoles.length > 0) {
      throw new ForbiddenException("Only Super Admin can create, update, reset, or deactivate Super Admin and IT Ops accounts.");
    }
  }

  private assertSecretBranchRoleConsistency(
    roles: UserRole[],
    secretBranchProfile?: {
      deskCode?: SecretBranchDeskCode;
      canManageUsers?: boolean;
      canVerify?: boolean;
      isActive?: boolean;
    },
  ) {
    const hasSecretBranchRole = roles.includes(UserRole.SECRET_BRANCH);

    if (hasSecretBranchRole && !secretBranchProfile) {
      throw new BadRequestException("Secret Branch accounts require a Secret Branch profile with a desk assignment.");
    }

    if (!hasSecretBranchRole && secretBranchProfile) {
      throw new BadRequestException("Secret Branch profile details can only be supplied for Secret Branch accounts.");
    }

    if (hasSecretBranchRole && !secretBranchProfile?.deskCode) {
      throw new BadRequestException("Secret Branch accounts require a desk code.");
    }
  }

  private normalizeUserInput<T extends Partial<CreateUserDto & UpdateUserDto>>(dto: T) {
    return {
      ...dto,
      fullName: dto.fullName?.trim().replace(/\s+/g, " "),
      username: dto.username?.trim().toLowerCase(),
      email: dto.email?.trim().toLowerCase(),
      badgeNo: dto.badgeNo?.trim().toUpperCase(),
      mobileNumber: dto.mobileNumber?.trim() || null,
      cnic: dto.cnic ? this.normalizeCnic(dto.cnic) : (dto.cnic === null ? null : undefined),
      positionTitle: dto.positionTitle?.trim() || null,
      scope: dto.scope
        ? {
            scopeTrack: dto.scope.scopeTrack ?? inferScopeTrack(dto.scope),
            wingId: dto.scope.wingId?.trim() || null,
            directorateId: dto.scope.directorateId?.trim() || null,
            regionId: dto.scope.regionId?.trim() || null,
            zoneId: dto.scope.zoneId?.trim() || null,
            circleId: dto.scope.circleId?.trim() || null,
            stationId: dto.scope.stationId?.trim() || null,
            branchId: dto.scope.branchId?.trim() || null,
            cellId: dto.scope.cellId?.trim() || null,
            officeId: dto.scope.officeId?.trim() || null,
            departmentId: dto.scope.departmentId?.trim() || null,
            departmentName: dto.scope.departmentName?.trim() || null,
          }
        : undefined,
      secretBranchProfile: dto.secretBranchProfile
        ? {
            deskCode: dto.secretBranchProfile.deskCode,
            canManageUsers: dto.secretBranchProfile.canManageUsers ?? false,
            canVerify: dto.secretBranchProfile.canVerify ?? false,
            isActive: dto.secretBranchProfile.isActive ?? true,
          }
        : undefined,
    };
  }

  private async resolveScope(scope?: {
    scopeTrack?: OrgScopeTrack | null;
    wingId?: string | null;
    directorateId?: string | null;
    regionId?: string | null;
    zoneId?: string | null;
    circleId?: string | null;
    stationId?: string | null;
    branchId?: string | null;
    cellId?: string | null;
    officeId?: string | null;
    departmentId?: string | null;
    departmentName?: string | null;
  }): Promise<ResolvedScope> {
    const normalizedInput = normalizeOrgScope(scope);
    let departmentId = scope?.departmentId ?? null;
    let departmentName = scope?.departmentName ?? null;
    let officeId = scope?.officeId ?? null;

    if (departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: departmentId },
        include: { office: true },
      });

      if (!department) {
        throw new BadRequestException("The selected department does not exist.");
      }

      departmentName = department.name;
      officeId = department.officeId;
    }

    if (officeId) {
      const office = await this.prisma.office.findUnique({ where: { id: officeId } });
      if (!office) {
        throw new BadRequestException("The selected office does not exist.");
      }

      if (scope?.scopeTrack && office.scopeTrack !== scope.scopeTrack) {
        throw new BadRequestException("The selected office does not match the chosen scope track.");
      }

      return {
        scopeTrack: office.scopeTrack,
        wingId: office.wingId,
        directorateId: office.directorateId,
        regionId: office.regionId,
        zoneId: office.zoneId,
        circleId: office.circleId,
        stationId: office.stationId,
        branchId: office.branchId,
        cellId: office.cellId,
        officeId: office.id,
        departmentId,
        departmentName,
      };
    }

    if (
      normalizedInput.scopeTrack === OrgScopeTrack.WING &&
      (normalizedInput.regionId || normalizedInput.zoneId || normalizedInput.circleId || normalizedInput.stationId || normalizedInput.branchId || normalizedInput.cellId)
    ) {
      throw new BadRequestException("Regional scope units cannot be mixed with the wing track.");
    }

    if (
      normalizedInput.scopeTrack === OrgScopeTrack.REGIONAL &&
      (normalizedInput.directorateId || (normalizedInput.wingId && !normalizedInput.regionId && !normalizedInput.zoneId))
    ) {
      throw new BadRequestException("Wing-only scope units cannot be mixed with the regional track.");
    }

    if (normalizedInput.scopeTrack === OrgScopeTrack.WING) {
      let wingId = normalizedInput.wingId;
      let directorateId = normalizedInput.directorateId;

      if (directorateId) {
        const directorate = await this.prisma.directorate.findUnique({ where: { id: directorateId } });
        if (!directorate) {
          throw new BadRequestException("The selected directorate does not exist.");
        }
        wingId = directorate.wingId;
      }

      if (wingId) {
        await this.ensureWingExists(wingId);
      }

      return {
        scopeTrack: OrgScopeTrack.WING,
        wingId,
        directorateId,
        regionId: null,
        zoneId: null,
        circleId: null,
        stationId: null,
        branchId: null,
        cellId: null,
        officeId: null,
        departmentId,
        departmentName,
      };
    }

    if (normalizedInput.cellId) {
      const cell = await this.prisma.cell.findUnique({ where: { id: normalizedInput.cellId } });
      if (!cell) {
        throw new BadRequestException("The selected cell does not exist.");
      }
      return {
        scopeTrack: OrgScopeTrack.REGIONAL,
        wingId: null,
        directorateId: null,
        regionId: cell.regionId,
        zoneId: cell.zoneId,
        circleId: cell.circleId,
        stationId: cell.stationId,
        branchId: cell.branchId,
        cellId: cell.id,
        officeId: null,
        departmentId,
        departmentName,
      };
    }

    if (normalizedInput.branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: normalizedInput.branchId } });
      if (!branch) {
        throw new BadRequestException("The selected branch does not exist.");
      }
      return {
        scopeTrack: OrgScopeTrack.REGIONAL,
        wingId: null,
        directorateId: null,
        regionId: branch.regionId,
        zoneId: branch.zoneId,
        circleId: branch.circleId,
        stationId: branch.stationId,
        branchId: branch.id,
        cellId: null,
        officeId: null,
        departmentId,
        departmentName,
      };
    }

    if (normalizedInput.stationId) {
      const station = await this.prisma.station.findUnique({ where: { id: normalizedInput.stationId } });
      if (!station) {
        throw new BadRequestException("The selected station does not exist.");
      }
      return {
        scopeTrack: OrgScopeTrack.REGIONAL,
        wingId: null,
        directorateId: null,
        regionId: station.regionId,
        zoneId: station.zoneId,
        circleId: station.circleId,
        stationId: station.id,
        branchId: null,
        cellId: null,
        officeId: null,
        departmentId,
        departmentName,
      };
    }

    if (normalizedInput.circleId) {
      const circle = await this.prisma.circle.findUnique({ where: { id: normalizedInput.circleId } });
      if (!circle) {
        throw new BadRequestException("The selected circle does not exist.");
      }
      return {
        scopeTrack: OrgScopeTrack.REGIONAL,
        wingId: null,
        directorateId: null,
        regionId: circle.regionId,
        zoneId: circle.zoneId,
        circleId: circle.id,
        stationId: null,
        branchId: null,
        cellId: null,
        officeId: null,
        departmentId,
        departmentName,
      };
    }

    if (normalizedInput.zoneId) {
      const zone = await this.prisma.zone.findUnique({ where: { id: normalizedInput.zoneId } });
      if (!zone) {
        throw new BadRequestException("The selected zone does not exist.");
      }
      return {
        scopeTrack: OrgScopeTrack.REGIONAL,
        wingId: null,
        directorateId: null,
        regionId: zone.regionId,
        zoneId: zone.id,
        circleId: null,
        stationId: null,
        branchId: null,
        cellId: null,
        officeId: null,
        departmentId,
        departmentName,
      };
    }

    if (normalizedInput.regionId) {
      const region = await this.prisma.region.findUnique({ where: { id: normalizedInput.regionId } });
      if (!region) {
        throw new BadRequestException("The selected region does not exist.");
      }
      return {
        scopeTrack: OrgScopeTrack.REGIONAL,
        wingId: null,
        directorateId: null,
        regionId: region.id,
        zoneId: null,
        circleId: null,
        stationId: null,
        branchId: null,
        cellId: null,
        officeId: null,
        departmentId,
        departmentName,
      };
    }

    return {
      scopeTrack: normalizedInput.scopeTrack,
      wingId: null,
      directorateId: null,
      regionId: null,
      zoneId: null,
      circleId: null,
      stationId: null,
      branchId: null,
      cellId: null,
      officeId: null,
      departmentId,
      departmentName,
    };
  }

  private async ensureWingExists(id: string) {
    const record = await this.prisma.wing.findUnique({ where: { id } });
    if (!record) {
      throw new BadRequestException("The selected wing does not exist.");
    }
  }

  private async syncSecretBranchProfile(
    tx: Prisma.TransactionClient,
    userId: string,
    roles: UserRole[],
    secretBranchProfile?: {
      deskCode?: SecretBranchDeskCode;
      canManageUsers?: boolean;
      canVerify?: boolean;
      isActive?: boolean;
    },
  ) {
    const hasSecretBranchRole = roles.includes(UserRole.SECRET_BRANCH);

    if (!hasSecretBranchRole) {
      await tx.secretBranchStaffProfile.deleteMany({
        where: { userId },
      });
      return;
    }

    if (!secretBranchProfile) {
      return;
    }

    await tx.secretBranchStaffProfile.upsert({
      where: { userId },
      create: {
        userId,
        deskCode: secretBranchProfile.deskCode ?? SecretBranchDeskCode.DA1,
        canManageUsers: secretBranchProfile.canManageUsers ?? false,
        canVerify: secretBranchProfile.canVerify ?? false,
        isActive: secretBranchProfile.isActive ?? true,
      },
      update: {
        deskCode: secretBranchProfile.deskCode ?? SecretBranchDeskCode.DA1,
        canManageUsers: secretBranchProfile.canManageUsers ?? false,
        canVerify: secretBranchProfile.canVerify ?? false,
        isActive: secretBranchProfile.isActive ?? true,
      },
    });
  }

  private mapManagedUser(user: ManagedUserRecord) {
    const roles = user.roleAssignments.map((assignment) => assignment.role);
    return {
      id: user.id,
      fullName: user.displayName,
      username: user.username,
      email: user.email,
      badgeNo: user.badgeNo,
      mobileNumber: user.mobileNumber ?? null,
      cnic: (user as unknown as { cnic: string | null }).cnic ?? null,
      positionTitle: user.positionTitle ?? null,
      departmentName: user.departmentName,
      status: user.isActive ? "active" : "inactive",
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      scope: {
        scopeTrack: user.scopeTrack,
        wingId: user.wingId,
        wingName: user.wing?.name ?? null,
        directorateId: user.directorateId ?? null,
        directorateName: user.directorate?.name ?? null,
        regionId: user.regionId ?? null,
        regionName: user.region?.name ?? null,
        zoneId: user.zoneId,
        zoneName: user.zone?.name ?? null,
        circleId: user.circleId ?? null,
        circleName: user.circle?.name ?? null,
        stationId: user.stationId ?? null,
        stationName: user.station?.name ?? null,
        branchId: user.branchId ?? null,
        branchName: user.branch?.name ?? null,
        cellId: user.cellId ?? null,
        cellName: user.cell?.name ?? null,
        officeId: user.officeId,
        officeName: user.office?.name ?? null,
        departmentId: user.departmentId ?? null,
        departmentName: user.department?.name ?? user.departmentName ?? null,
      },
      secretBranchProfile: user.secretBranchProfile
        ? {
            deskCode: user.secretBranchProfile.deskCode,
            canManageUsers: user.secretBranchProfile.canManageUsers,
            canVerify: user.secretBranchProfile.canVerify,
            isActive: user.secretBranchProfile.isActive,
          }
        : null,
      roles,
      roleLabels: roles.map((role) => displayRole(role)),
    };
  }

  private normalizeCnic(cnic: string) {
    const digits = cnic.replace(/\D/g, "");
    if (digits.length === 13) {
      return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
    }
    return cnic.trim();
  }

  private rethrowUniqueConstraint(error: unknown, message: string): never | void {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new ConflictException(message);
    }
  }

  generateTemporaryPassword() {
    return randomBytes(9).toString("base64url");
  }
}
