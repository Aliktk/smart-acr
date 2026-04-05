import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { canViewAudit, loadScopedUser } from "../../helpers/security.utils";
import { mapAudit } from "../../helpers/view-mappers";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    activeRole: UserRole,
    query?: {
      page?: number;
      pageSize?: number;
      action?: string;
      actorRole?: string;
      actorName?: string;
      recordQuery?: string;
      dateFrom?: string;
      dateTo?: string;
      module?: "ACR" | "Authentication" | "Settings" | "Administration" | "System";
      eventType?: "create" | "update" | "transition" | "archive" | "authentication" | "system";
    },
  ) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    if (!canViewAudit(user)) {
      throw new ForbiddenException("The current role cannot access audit logs.");
    }

    const page = Math.max(1, query?.page ?? 1);
    const pageSize = Math.min(100, Math.max(10, query?.pageSize ?? 25));
    const skip = (page - 1) * pageSize;

    const where: Prisma.AuditLogWhereInput = {};
    const and: Prisma.AuditLogWhereInput[] = [];

    if (query?.action?.trim()) {
      and.push({
        action: {
          contains: query.action.trim(),
          mode: "insensitive",
        },
      });
    }

    if (query?.actorRole?.trim()) {
      and.push({
        actorRole: query.actorRole.trim(),
      });
    }

    if (query?.actorName?.trim()) {
      and.push({
        actor: {
          is: {
            displayName: {
              contains: query.actorName.trim(),
              mode: "insensitive",
            },
          },
        },
      });
    }

    if (query?.recordQuery?.trim()) {
      const recordQuery = query.recordQuery.trim();
      and.push({
        OR: [
          {
            acrRecord: {
              is: {
                acrNo: {
                  contains: recordQuery,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            acrRecordId: {
              equals: recordQuery,
            },
          },
        ],
      });
    }

    if (query?.dateFrom || query?.dateTo) {
      and.push({
        createdAt: {
          ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
          ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) } : {}),
        },
      });
    }

    if (query?.module) {
      and.push(this.moduleFilter(query.module));
    }

    if (query?.eventType) {
      and.push(this.eventTypeFilter(query.eventType));
    }

    const scoped = this.scopeFilter(user.id, user.activeRole, user.activeAssignment?.wingId ?? user.wingId ?? null, user.activeAssignment?.zoneId ?? user.zoneId ?? null);
    if (scoped) {
      and.push(scoped);
    }

    if (and.length > 0) {
      where.AND = and;
    }

    const [logs, total, actionFacets, roleFacets] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: true,
          acrRecord: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        distinct: ["action"],
        select: { action: true },
        orderBy: { action: "asc" },
        take: 50,
      }),
      this.prisma.auditLog.findMany({
        where,
        distinct: ["actorRole"],
        select: { actorRole: true },
        orderBy: { actorRole: "asc" },
        take: 30,
      }),
    ]);

    return {
      items: logs.map((log) => mapAudit(log)),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      facets: {
        actions: actionFacets.map((entry) => entry.action).filter(Boolean),
        actorRoles: roleFacets.map((entry) => entry.actorRole).filter(Boolean),
        modules: ["ACR", "Authentication", "Settings", "Administration", "System"],
        eventTypes: ["create", "update", "transition", "archive", "authentication", "system"],
      },
    };
  }

  private scopeFilter(
    userId: string,
    activeRole: UserRole,
    wingId?: string | null,
    zoneId?: string | null,
  ): Prisma.AuditLogWhereInput | null {
    if (([UserRole.SUPER_ADMIN, UserRole.IT_OPS, UserRole.SECRET_BRANCH] as UserRole[]).includes(activeRole)) {
      return null;
    }

    if (activeRole === UserRole.WING_OVERSIGHT && wingId) {
      return {
        OR: [
          { acrRecord: { is: { employee: { wingId } } } },
          { actor: { is: { OR: [{ wingId }, { roleAssignments: { some: { wingId } } }] } } },
          { actorId: userId },
        ],
      };
    }

    if (activeRole === UserRole.ZONAL_OVERSIGHT && zoneId) {
      return {
        OR: [
          { acrRecord: { is: { employee: { zoneId } } } },
          { actor: { is: { OR: [{ zoneId }, { roleAssignments: { some: { zoneId } } }] } } },
          { actorId: userId },
        ],
      };
    }

    return {
      OR: [{ actorId: userId }],
    };
  }

  private moduleFilter(module: "ACR" | "Authentication" | "Settings" | "Administration" | "System"): Prisma.AuditLogWhereInput {
    switch (module) {
      case "ACR":
        return {
          OR: [{ acrRecordId: { not: null } }, { action: { contains: "ACR", mode: "insensitive" } }],
        };
      case "Authentication":
        return {
          OR: [
            { action: { contains: "login", mode: "insensitive" } },
            { action: { contains: "logout", mode: "insensitive" } },
            { action: { contains: "role switch", mode: "insensitive" } },
            { action: { contains: "role changed", mode: "insensitive" } },
          ],
        };
      case "Settings":
        return {
          OR: [
            { action: { contains: "profile", mode: "insensitive" } },
            { action: { contains: "password", mode: "insensitive" } },
            { action: { contains: "preference", mode: "insensitive" } },
            { action: { contains: "avatar", mode: "insensitive" } },
          ],
        };
      case "Administration":
        return {
          OR: [
            { action: { contains: "admin setting", mode: "insensitive" } },
            { action: { contains: "system setting", mode: "insensitive" } },
          ],
        };
      case "System":
      default:
        return {
          AND: [
            { acrRecordId: null },
            {
              NOT: [
                this.moduleFilter("Authentication"),
                this.moduleFilter("Settings"),
                this.moduleFilter("Administration"),
              ],
            },
          ],
        };
    }
  }

  private eventTypeFilter(
    eventType: "create" | "update" | "transition" | "archive" | "authentication" | "system",
  ): Prisma.AuditLogWhereInput {
    switch (eventType) {
      case "create":
        return { action: { contains: "created", mode: "insensitive" } };
      case "update":
        return {
          OR: [
            { action: { contains: "updated", mode: "insensitive" } },
            { action: { contains: "profile", mode: "insensitive" } },
            { action: { contains: "password", mode: "insensitive" } },
            { action: { contains: "preference", mode: "insensitive" } },
          ],
        };
      case "transition":
        return {
          OR: [
            { action: { contains: "submit", mode: "insensitive" } },
            { action: { contains: "forward", mode: "insensitive" } },
            { action: { contains: "return", mode: "insensitive" } },
            { action: { contains: "transition", mode: "insensitive" } },
            { action: { contains: "switch", mode: "insensitive" } },
          ],
        };
      case "archive":
        return {
          OR: [
            { action: { contains: "archive", mode: "insensitive" } },
            { action: { contains: "finalized", mode: "insensitive" } },
          ],
        };
      case "authentication":
        return this.moduleFilter("Authentication");
      case "system":
      default:
        return {
          NOT: [
            this.eventTypeFilter("create"),
            this.eventTypeFilter("update"),
            this.eventTypeFilter("transition"),
            this.eventTypeFilter("archive"),
            this.eventTypeFilter("authentication"),
          ],
        };
    }
  }
}
