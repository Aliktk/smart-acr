import { UnauthorizedException } from "@nestjs/common";
import { AcrWorkflowState, Prisma, UserRole } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

const SCOPED_USER_INCLUDE = {
  employeeProfiles: {
    select: {
      id: true,
    },
  },
  roleAssignments: true,
  wing: true,
  zone: true,
  office: true,
} satisfies Prisma.UserInclude;

type LoadedScopedUser = Prisma.UserGetPayload<{
  include: typeof SCOPED_USER_INCLUDE;
}>;

export type ScopedUser = LoadedScopedUser & {
  activeRole: UserRole;
  activeAssignment: LoadedScopedUser["roleAssignments"][number] | null;
};

type AcrScopeRecord = {
  employeeId: string;
  initiatedById: string;
  reportingOfficerId: string;
  countersigningOfficerId: string | null;
  currentHolderId: string | null;
  workflowState: AcrWorkflowState;
  timeline?: Array<{ actorId: string | null }>;
  employee?: {
    id: string;
    wingId: string;
    zoneId: string;
    officeId: string;
  } | null;
};

type EmployeeScopeRecord = {
  id: string;
  userId?: string | null;
  wingId: string;
  zoneId: string;
  officeId: string;
  reportingOfficerId?: string | null;
  countersigningOfficerId?: string | null;
};

type AcrTransitionAction =
  | "save_draft"
  | "submit_to_reporting"
  | "forward_to_countersigning"
  | "submit_to_secret_branch"
  | "return_to_clerk";

const ANALYTICS_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.IT_OPS,
  UserRole.SECRET_BRANCH,
  UserRole.DG,
  UserRole.EXECUTIVE_VIEWER,
  UserRole.WING_OVERSIGHT,
  UserRole.ZONAL_OVERSIGHT,
];

const AUDIT_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.IT_OPS,
  UserRole.SECRET_BRANCH,
  UserRole.WING_OVERSIGHT,
  UserRole.ZONAL_OVERSIGHT,
];

const USER_ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.IT_OPS];

function scopeValue(user: ScopedUser, field: "wingId" | "zoneId" | "officeId") {
  return user.activeAssignment?.[field] ?? user[field] ?? null;
}

function matchesEmployeeScope(
  employee: Pick<EmployeeScopeRecord, "wingId" | "zoneId" | "officeId">,
  scopeField: "wingId" | "zoneId" | "officeId",
  scopeEntry?: string | null,
) {
  return Boolean(scopeEntry && employee[scopeField] === scopeEntry);
}

export function hasRole(user: ScopedUser, role: UserRole | string) {
  return user.activeRole === role;
}

export function canAccessAcr(user: ScopedUser, acr: AcrScopeRecord) {
  const employee = acr.employee;
  if (!employee) {
    return hasRole(user, UserRole.SUPER_ADMIN) || hasRole(user, UserRole.IT_OPS) || hasRole(user, UserRole.SECRET_BRANCH);
  }

  if (
    hasRole(user, UserRole.SUPER_ADMIN) ||
    hasRole(user, UserRole.IT_OPS) ||
    hasRole(user, UserRole.SECRET_BRANCH) ||
    hasRole(user, UserRole.DG) ||
    hasRole(user, UserRole.EXECUTIVE_VIEWER)
  ) {
    return true;
  }

  const hasHistoricalTouch =
    acr.initiatedById === user.id ||
    acr.currentHolderId === user.id ||
    acr.timeline?.some((entry) => entry.actorId === user.id) === true;

  if (hasRole(user, UserRole.WING_OVERSIGHT)) {
    return matchesEmployeeScope(employee, "wingId", scopeValue(user, "wingId"));
  }

  if (hasRole(user, UserRole.ZONAL_OVERSIGHT)) {
    return matchesEmployeeScope(employee, "zoneId", scopeValue(user, "zoneId"));
  }

  if (hasRole(user, UserRole.CLERK)) {
    return hasHistoricalTouch;
  }

  if (hasRole(user, UserRole.REPORTING_OFFICER)) {
    return acr.reportingOfficerId === user.id || hasHistoricalTouch;
  }

  if (hasRole(user, UserRole.COUNTERSIGNING_OFFICER)) {
    return acr.countersigningOfficerId === user.id || hasHistoricalTouch;
  }

  if (hasRole(user, UserRole.EMPLOYEE)) {
    return Boolean(user.employeeProfiles?.some((profile) => profile.id === acr.employeeId));
  }

  return false;
}

export function canAccessEmployee(user: ScopedUser, employee: EmployeeScopeRecord) {
  if (
    hasRole(user, UserRole.SUPER_ADMIN) ||
    hasRole(user, UserRole.IT_OPS) ||
    hasRole(user, UserRole.SECRET_BRANCH) ||
    hasRole(user, UserRole.DG) ||
    hasRole(user, UserRole.EXECUTIVE_VIEWER)
  ) {
    return true;
  }

  if (hasRole(user, UserRole.WING_OVERSIGHT)) {
    return matchesEmployeeScope(employee, "wingId", scopeValue(user, "wingId"));
  }

  if (hasRole(user, UserRole.ZONAL_OVERSIGHT)) {
    return matchesEmployeeScope(employee, "zoneId", scopeValue(user, "zoneId"));
  }

  if (hasRole(user, UserRole.CLERK)) {
    return matchesEmployeeScope(employee, "officeId", scopeValue(user, "officeId"));
  }

  if (hasRole(user, UserRole.REPORTING_OFFICER)) {
    return employee.reportingOfficerId === user.id;
  }

  if (hasRole(user, UserRole.COUNTERSIGNING_OFFICER)) {
    return employee.countersigningOfficerId === user.id;
  }

  if (hasRole(user, UserRole.EMPLOYEE)) {
    return Boolean(user.employeeProfiles?.some((profile) => profile.id === employee.id));
  }

  return false;
}

export function canCreateAcr(user: ScopedUser) {
  return hasRole(user, UserRole.SUPER_ADMIN) || hasRole(user, UserRole.IT_OPS) || hasRole(user, UserRole.CLERK);
}

export function canCreateEmployeeRecord(user: ScopedUser) {
  return canCreateAcr(user);
}

export function canTransitionAcr(user: ScopedUser, acr: AcrScopeRecord, action: AcrTransitionAction) {
  if (hasRole(user, UserRole.SUPER_ADMIN) || hasRole(user, UserRole.IT_OPS)) {
    return true;
  }

  if (action === "save_draft" || action === "submit_to_reporting") {
    return hasRole(user, UserRole.CLERK) && acr.currentHolderId === user.id && (acr.initiatedById === user.id || acr.currentHolderId === user.id);
  }

  if (action === "forward_to_countersigning") {
    return hasRole(user, UserRole.REPORTING_OFFICER) && acr.reportingOfficerId === user.id && acr.currentHolderId === user.id;
  }

  if (action === "submit_to_secret_branch" || action === "return_to_clerk") {
    if (hasRole(user, UserRole.REPORTING_OFFICER) && acr.reportingOfficerId === user.id && acr.currentHolderId === user.id) {
      return true;
    }

    if (hasRole(user, UserRole.COUNTERSIGNING_OFFICER) && acr.countersigningOfficerId === user.id && acr.currentHolderId === user.id) {
      return true;
    }

    return false;
  }

  return false;
}

export function canEditAcrForm(user: ScopedUser, acr: AcrScopeRecord) {
  if (hasRole(user, UserRole.SUPER_ADMIN) || hasRole(user, UserRole.IT_OPS)) {
    return true;
  }

  if (hasRole(user, UserRole.CLERK)) {
    return acr.currentHolderId === user.id &&
      (acr.initiatedById === user.id || acr.currentHolderId === user.id) &&
      (acr.workflowState === AcrWorkflowState.DRAFT || acr.workflowState === AcrWorkflowState.RETURNED);
  }

  if (hasRole(user, UserRole.REPORTING_OFFICER)) {
    return acr.reportingOfficerId === user.id &&
      acr.currentHolderId === user.id &&
      acr.workflowState === AcrWorkflowState.PENDING_REPORTING;
  }

  if (hasRole(user, UserRole.COUNTERSIGNING_OFFICER)) {
    return acr.countersigningOfficerId === user.id &&
      acr.currentHolderId === user.id &&
      acr.workflowState === AcrWorkflowState.PENDING_COUNTERSIGNING;
  }

  return false;
}

export function canViewAnalytics(user: ScopedUser) {
  return ANALYTICS_ROLES.includes(user.activeRole);
}

export function canViewOrganization(user: ScopedUser) {
  return ANALYTICS_ROLES.includes(user.activeRole);
}

export function canViewAudit(user: ScopedUser) {
  return AUDIT_ROLES.includes(user.activeRole);
}

export function canManageUsers(user: ScopedUser) {
  return USER_ADMIN_ROLES.includes(user.activeRole);
}

export function displayRole(role: string) {
  if (role === UserRole.DG || role === "DG") {
    return "DG";
  }

  if (role === UserRole.IT_OPS || role === "IT_OPS") {
    return "IT Ops";
  }

  return role
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

export async function loadScopedUser(prisma: PrismaClient, userId: string, activeRole: UserRole) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: SCOPED_USER_INCLUDE,
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedException("Authenticated user could not be resolved.");
  }

  const activeAssignment = user.roleAssignments.find((assignment) => assignment.role === activeRole) ?? null;
  if (!activeAssignment) {
    throw new UnauthorizedException("The active role is no longer assigned to this account.");
  }

  return {
    ...user,
    activeRole,
    activeAssignment,
  } satisfies ScopedUser;
}
