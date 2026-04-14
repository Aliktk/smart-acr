import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { loadScopedUser } from "../../helpers/security.utils";

export interface AuthorityResolution {
  reportingAuthorityTitle: string;
  countersigningAuthorityTitle: string | null;
  matchedRuleId: string;
  priority: number;
}

export interface AssignmentValidation {
  valid: boolean;
  warnings: string[];
  suggestedReportingTitle: string | null;
  suggestedCountersigningTitle: string | null;
}

@Injectable()
export class AuthorityMatrixService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve the correct reporting/countersigning authority titles for an employee
   * based on their unit type, wing, BPS, and post title.
   */
  async resolveAuthority(employeeId: string): Promise<AuthorityResolution | null> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        wing: { select: { code: true } },
        office: { select: { code: true, scopeTrack: true } },
      },
    });

    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    const wingCode = employee.wing?.code ?? null;
    const unitType = employee.office?.scopeTrack === "REGIONAL" ? "ZONAL" : "HQ";

    const rules = await this.prisma.authorityMatrixRule.findMany({
      where: {
        isActive: true,
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: new Date() } },
        ],
        ...(wingCode ? { OR: [{ wingCode }, { wingCode: null }] } : {}),
      },
      orderBy: { priority: "desc" },
    });

    const matched = rules.find((rule) => {
      if (rule.unitType !== unitType && rule.unitType !== "ANY") return false;
      if (rule.wingCode && rule.wingCode !== wingCode) return false;
      if (rule.bpsMin !== null && employee.bps < rule.bpsMin) return false;
      if (rule.bpsMax !== null && employee.bps > rule.bpsMax) return false;
      if (rule.postTitle !== "*" && rule.postTitle.toLowerCase() !== employee.designation.toLowerCase()) return false;
      if (rule.templateFamily && rule.templateFamily !== employee.templateFamily) return false;
      return true;
    });

    if (!matched) return null;

    return {
      reportingAuthorityTitle: matched.reportingAuthorityTitle,
      countersigningAuthorityTitle: matched.countersigningAuthorityTitle,
      matchedRuleId: matched.id,
      priority: matched.priority,
    };
  }

  /**
   * Validate whether the assigned RO/CSO match the authority matrix expectations.
   * Returns warnings (non-blocking) if there's a mismatch.
   */
  async validateAssignment(
    employeeId: string,
    reportingOfficerId: string,
    countersigningOfficerId: string | null,
  ): Promise<AssignmentValidation> {
    const resolution = await this.resolveAuthority(employeeId);

    if (!resolution) {
      return {
        valid: true,
        warnings: ["No authority matrix rule found for this employee. Manual assignment accepted."],
        suggestedReportingTitle: null,
        suggestedCountersigningTitle: null,
      };
    }

    const warnings: string[] = [];

    const ro = await this.prisma.user.findUnique({
      where: { id: reportingOfficerId },
      include: { employeeProfiles: { select: { designation: true } } },
    });

    if (ro) {
      const roDesignation = ro.employeeProfiles?.[0]?.designation ?? ro.positionTitle ?? "";
      if (
        roDesignation.toLowerCase() !== resolution.reportingAuthorityTitle.toLowerCase() &&
        !roDesignation.toLowerCase().includes(resolution.reportingAuthorityTitle.toLowerCase())
      ) {
        warnings.push(
          `Authority matrix expects Reporting Officer to be "${resolution.reportingAuthorityTitle}", but assigned officer is "${roDesignation}".`,
        );
      }
    }

    if (countersigningOfficerId && resolution.countersigningAuthorityTitle) {
      const cso = await this.prisma.user.findUnique({
        where: { id: countersigningOfficerId },
        include: { employeeProfiles: { select: { designation: true } } },
      });

      if (cso) {
        const csoDesignation = cso.employeeProfiles?.[0]?.designation ?? cso.positionTitle ?? "";
        if (
          csoDesignation.toLowerCase() !== resolution.countersigningAuthorityTitle.toLowerCase() &&
          !csoDesignation.toLowerCase().includes(resolution.countersigningAuthorityTitle.toLowerCase())
        ) {
          warnings.push(
            `Authority matrix expects Countersigning Officer to be "${resolution.countersigningAuthorityTitle}", but assigned officer is "${csoDesignation}".`,
          );
        }
      }
    }

    return {
      valid: warnings.length === 0,
      warnings,
      suggestedReportingTitle: resolution.reportingAuthorityTitle,
      suggestedCountersigningTitle: resolution.countersigningAuthorityTitle,
    };
  }

  /**
   * List all authority matrix rules with optional filtering.
   */
  async listRules(filters?: { unitType?: string; wingCode?: string; isActive?: boolean }) {
    const where: Prisma.AuthorityMatrixRuleWhereInput = {};
    if (filters?.unitType) where.unitType = filters.unitType;
    if (filters?.wingCode) where.wingCode = filters.wingCode;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    return this.prisma.authorityMatrixRule.findMany({
      where,
      orderBy: [{ unitType: "asc" }, { priority: "desc" }, { postTitle: "asc" }],
    });
  }

  /**
   * Create or update an authority matrix rule. SUPER_ADMIN only.
   */
  async upsertRule(
    userId: string,
    activeRole: UserRole,
    data: Prisma.AuthorityMatrixRuleCreateInput,
  ) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);

    if (user.activeRole !== UserRole.SUPER_ADMIN && user.activeRole !== UserRole.IT_OPS) {
      throw new ForbiddenException("Only system administrators can manage authority matrix rules.");
    }

    return this.prisma.authorityMatrixRule.create({ data });
  }
}
