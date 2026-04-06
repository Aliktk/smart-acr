import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { PrismaService } from "../../common/prisma.service";
import { canManageUsers, displayRole, loadScopedUser } from "../../helpers/security.utils";
import { ListUsersDto } from "./dto/list-users.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { AdminResetPasswordDto } from "./dto/admin-reset-password.dto";

const USER_INCLUDE = {
  roleAssignments: true,
  wing: true,
  zone: true,
  office: true,
} satisfies Prisma.UserInclude;

type ManagedUserRecord = Prisma.UserGetPayload<{
  include: typeof USER_INCLUDE;
}>;

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
    await this.requireUserAdmin(actorId, activeRole);

    const [wings, zones, offices] = await Promise.all([
      this.prisma.wing.findMany({ orderBy: { name: "asc" } }),
      this.prisma.zone.findMany({ orderBy: { name: "asc" } }),
      this.prisma.office.findMany({ orderBy: { name: "asc" } }),
    ]);

    return {
      roles: Object.values(UserRole).map((role) => ({
        code: role,
        label: displayRole(role),
      })),
      wings: wings.map((wing) => ({ id: wing.id, name: wing.name, code: wing.code })),
      zones: zones.map((zone) => ({ id: zone.id, name: zone.name, code: zone.code, wingId: zone.wingId })),
      offices: offices.map((office) => ({
        id: office.id,
        name: office.name,
        code: office.code,
        wingId: office.wingId,
        zoneId: office.zoneId,
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
    const scope = await this.resolveScope(normalized.scope);
    const roles = this.uniqueRoles(normalized.roles);

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: normalized.username,
          email: normalized.email,
          badgeNo: normalized.badgeNo,
          displayName: normalized.fullName,
          mobileNumber: normalized.mobileNumber,
          departmentName: scope.departmentName,
          passwordHash: await bcrypt.hash(dto.temporaryPassword, 12),
          mustChangePassword: dto.mustChangePassword ?? true,
          isActive: dto.isActive ?? true,
          wingId: scope.wingId,
          zoneId: scope.zoneId,
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
          wingId: scope.wingId,
          zoneId: scope.zoneId,
          officeId: scope.officeId,
        })),
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: displayRole(actor.activeRole),
          action: "User account created",
          recordType: "USER",
          recordId: user.id,
          ipAddress: ipAddress ?? "unknown",
          details: `Created user account for ${user.displayName} (${user.username}) with roles ${roles.map((role) => displayRole(role)).join(", ")}.`,
          metadata: {
            roles,
            username: user.username,
            email: user.email,
            badgeNo: user.badgeNo,
          },
        },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: USER_INCLUDE,
      });
    }).catch((error: unknown) => {
      this.rethrowUniqueConstraint(error, "A user already exists with the same username, email, or badge number.");
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
    const scope = dto.scope ? await this.resolveScope(normalized.scope) : {
      wingId: existing.wingId,
      zoneId: existing.zoneId,
      officeId: existing.officeId,
      departmentName: existing.departmentName,
    };
    const roles = dto.roles ? this.uniqueRoles(dto.roles) : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          username: normalized.username ?? undefined,
          email: normalized.email ?? undefined,
          badgeNo: normalized.badgeNo ?? undefined,
          displayName: normalized.fullName ?? undefined,
          mobileNumber: normalized.mobileNumber === undefined ? undefined : normalized.mobileNumber,
          departmentName: scope.departmentName,
          isActive: dto.isActive,
          mustChangePassword: dto.mustChangePassword,
          wingId: scope.wingId,
          zoneId: scope.zoneId,
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
            wingId: scope.wingId,
            zoneId: scope.zoneId,
            officeId: scope.officeId,
          })),
        });
      }

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
          },
        },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: userId },
        include: USER_INCLUDE,
      });
    }).catch((error: unknown) => {
      this.rethrowUniqueConstraint(error, "A user already exists with the same username, email, or badge number.");
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
      select: { id: true, displayName: true },
    });

    if (!user) {
      throw new NotFoundException("The requested user account could not be found.");
    }

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
      select: { id: true, displayName: true, isActive: true },
    });

    if (!existing) {
      throw new NotFoundException("The requested user account could not be found.");
    }

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

    if (query.wingId) {
      and.push({ wingId: query.wingId });
    }

    if (query.zoneId) {
      and.push({ zoneId: query.zoneId });
    }

    if (query.officeId) {
      and.push({ officeId: query.officeId });
    }

    return and.length > 0 ? { AND: and } : {};
  }

  private uniqueRoles(roles: UserRole[]) {
    return Array.from(new Set(roles));
  }

  private normalizeUserInput<T extends Partial<CreateUserDto & UpdateUserDto>>(dto: T) {
    return {
      ...dto,
      fullName: dto.fullName?.trim().replace(/\s+/g, " "),
      username: dto.username?.trim().toLowerCase(),
      email: dto.email?.trim().toLowerCase(),
      badgeNo: dto.badgeNo?.trim().toUpperCase(),
      mobileNumber: dto.mobileNumber?.trim() || null,
      scope: dto.scope
        ? {
            wingId: dto.scope.wingId?.trim() || null,
            zoneId: dto.scope.zoneId?.trim() || null,
            officeId: dto.scope.officeId?.trim() || null,
            departmentName: dto.scope.departmentName?.trim() || null,
          }
        : undefined,
    };
  }

  private async resolveScope(scope?: {
    wingId?: string | null;
    zoneId?: string | null;
    officeId?: string | null;
    departmentName?: string | null;
  }) {
    if (!scope) {
      return {
        wingId: null,
        zoneId: null,
        officeId: null,
        departmentName: null,
      };
    }

    let wingId = scope.wingId ?? null;
    let zoneId = scope.zoneId ?? null;
    let officeId = scope.officeId ?? null;

    if (officeId) {
      const office = await this.prisma.office.findUnique({
        where: { id: officeId },
      });

      if (!office) {
        throw new BadRequestException("The selected office does not exist.");
      }

      if (zoneId && zoneId !== office.zoneId) {
        throw new BadRequestException("The selected office does not belong to the selected zone.");
      }

      if (wingId && wingId !== office.wingId) {
        throw new BadRequestException("The selected office does not belong to the selected wing.");
      }

      zoneId = office.zoneId;
      wingId = office.wingId;
    }

    if (zoneId) {
      const zone = await this.prisma.zone.findUnique({
        where: { id: zoneId },
      });

      if (!zone) {
        throw new BadRequestException("The selected zone does not exist.");
      }

      if (wingId && wingId !== zone.wingId) {
        throw new BadRequestException("The selected zone does not belong to the selected wing.");
      }

      wingId = zone.wingId;
    }

    if (wingId) {
      const wing = await this.prisma.wing.findUnique({
        where: { id: wingId },
      });

      if (!wing) {
        throw new BadRequestException("The selected wing does not exist.");
      }
    }

    return {
      wingId,
      zoneId,
      officeId,
      departmentName: scope.departmentName ?? null,
    };
  }

  private mapManagedUser(user: ManagedUserRecord) {
    const roles = user.roleAssignments.map((assignment) => assignment.role);
    return {
      id: user.id,
      fullName: user.displayName,
      username: user.username,
      email: user.email,
      badgeNo: user.badgeNo,
      mobileNumber: user.mobileNumber,
      departmentName: user.departmentName,
      status: user.isActive ? "active" : "inactive",
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      scope: {
        wingId: user.wingId,
        wingName: user.wing?.name ?? null,
        zoneId: user.zoneId,
        zoneName: user.zone?.name ?? null,
        officeId: user.officeId,
        officeName: user.office?.name ?? null,
        departmentName: user.departmentName ?? null,
      },
      roles,
      roleLabels: roles.map((role) => displayRole(role)),
    };
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
