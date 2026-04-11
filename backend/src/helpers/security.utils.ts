import { UnauthorizedException } from "@nestjs/common";
import { AcrWorkflowState, OrgScopeTrack, Prisma, UserRole } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { buildScopeWhere, matchesOrgScope, normalizeOrgScope } from "./org-scope.utils";

const SCOPED_USER_INCLUDE = {
  employeeProfiles: {
    select: {
      id: true,
    },
  },
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
  } | null;
};

type EmployeeScopeRecord = {
  id: string;
  userId?: string | null;
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
  reportingOfficerId?: string | null;
  countersigningOfficerId?: string | null;
};

type AcrTransitionAction =
  | "save_draft"
  | "forward_to_admin_office"
  | "admin_forward_to_piab"
  | "intake_accept"
  | "intake_return"
  | "resubmit_after_rectification"
  | "submit_to_reporting"
  | "forward_to_countersigning"
  | "submit_to_secret_branch"
  | "complete_secret_branch_review"
  | "verify_secret_branch"
  | "return_to_clerk"
  | "return_to_reporting"
  | "return_to_countersigning";

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

const USER_ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN];

function hasAdministrativeBypass(user: ScopedUser) {
  return hasRole(user, UserRole.SUPER_ADMIN) || hasRole(user, UserRole.IT_OPS);
}

function hasSecretBranchAccess(user: ScopedUser) {
  return hasRole(user, UserRole.SECRET_BRANCH) && (user.secretBranchProfile?.isActive ?? true);
}

function isSecretBranchManager(user: ScopedUser) {
  return hasSecretBranchAccess(user) && Boolean(user.secretBranchProfile?.canManageUsers);
}

function isSecretBranchVerifier(user: ScopedUser) {
  return hasSecretBranchAccess(user) && Boolean(user.secretBranchProfile?.canVerify);
}

export function hasRole(user: ScopedUser, role: UserRole | string) {
  return user.activeRole === role;
}

export function effectiveScope(user: ScopedUser) {
  return normalizeOrgScope({
    scopeTrack: user.activeAssignment?.scopeTrack ?? user.scopeTrack,
    wingId: user.activeAssignment?.wingId ?? user.wingId,
    directorateId: user.activeAssignment?.directorateId ?? user.directorateId,
    regionId: user.activeAssignment?.regionId ?? user.regionId,
    zoneId: user.activeAssignment?.zoneId ?? user.zoneId,
    circleId: user.activeAssignment?.circleId ?? user.circleId,
    stationId: user.activeAssignment?.stationId ?? user.stationId,
    branchId: user.activeAssignment?.branchId ?? user.branchId,
    cellId: user.activeAssignment?.cellId ?? user.cellId,
    officeId: user.activeAssignment?.officeId ?? user.officeId,
    departmentId: user.activeAssignment?.departmentId ?? user.departmentId,
  });
}

export function buildScopedOrgWhere(user: ScopedUser) {
  return buildScopeWhere(effectiveScope(user));
}

export function buildAcrAccessPreFilter(user: ScopedUser): Prisma.AcrRecordWhereInput | null {
  if (
    hasAdministrativeBypass(user) ||
    hasSecretBranchAccess(user) ||
    hasRole(user, UserRole.DG) ||
    hasRole(user, UserRole.EXECUTIVE_VIEWER)
  ) {
    return null;
  }

  if (hasRole(user, UserRole.WING_OVERSIGHT) || hasRole(user, UserRole.ZONAL_OVERSIGHT)) {
    const scopeWhere = buildScopeWhere(effectiveScope(user));
    return scopeWhere ? { employee: scopeWhere } : null;
  }

  if (hasRole(user, UserRole.EMPLOYEE)) {
    const profileIds = user.employeeProfiles?.map((p) => p.id) ?? [];
    return { employeeId: { in: profileIds } };
  }

  const conditions: Prisma.AcrRecordWhereInput[] = [
    { initiatedById: user.id },
    { currentHolderId: user.id },
    { timeline: { some: { actorId: user.id } } },
  ];

  if (hasRole(user, UserRole.REPORTING_OFFICER)) {
    conditions.push({ reportingOfficerId: user.id });
  }

  if (hasRole(user, UserRole.COUNTERSIGNING_OFFICER)) {
    conditions.push({ countersigningOfficerId: user.id });
  }

  return { OR: conditions };
}

export function canAccessAcr(user: ScopedUser, acr: AcrScopeRecord) {
  const employee = acr.employee;
  if (!employee) {
    return hasAdministrativeBypass(user) || hasSecretBranchAccess(user);
  }

  if (
    hasAdministrativeBypass(user) ||
    hasSecretBranchAccess(user) ||
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
    return matchesOrgScope(effectiveScope(user), employee);
  }

  if (hasRole(user, UserRole.ZONAL_OVERSIGHT)) {
    return matchesOrgScope(effectiveScope(user), employee);
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
    hasAdministrativeBypass(user) ||
    hasSecretBranchAccess(user) ||
    hasRole(user, UserRole.DG) ||
    hasRole(user, UserRole.EXECUTIVE_VIEWER)
  ) {
    return true;
  }

  if (hasRole(user, UserRole.WING_OVERSIGHT)) {
    return matchesOrgScope(effectiveScope(user), employee);
  }

  if (hasRole(user, UserRole.ZONAL_OVERSIGHT)) {
    return matchesOrgScope(effectiveScope(user), employee);
  }

  if (hasRole(user, UserRole.CLERK)) {
    return matchesOrgScope(effectiveScope(user), employee);
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
  return hasAdministrativeBypass(user) || hasRole(user, UserRole.CLERK);
}

export function canCreateEmployeeRecord(user: ScopedUser) {
  return canCreateAcr(user);
}

export function canTransitionAcr(user: ScopedUser, acr: AcrScopeRecord, action: AcrTransitionAction) {
  if (hasAdministrativeBypass(user)) {
    return true;
  }

  if (action === "save_draft" || action === "submit_to_reporting" || action === "forward_to_admin_office") {
    return hasRole(user, UserRole.CLERK) && acr.currentHolderId === user.id;
  }

  if (action === "admin_forward_to_piab" || action === "resubmit_after_rectification") {
    return hasRole(user, UserRole.CLERK) && acr.currentHolderId === user.id;
  }

  if (action === "intake_accept" || action === "intake_return") {
    return hasSecretBranchAccess(user);
  }

  if (action === "forward_to_countersigning") {
    return hasRole(user, UserRole.REPORTING_OFFICER) && acr.reportingOfficerId === user.id && acr.currentHolderId === user.id;
  }

  if (action === "submit_to_secret_branch") {
    if (hasRole(user, UserRole.REPORTING_OFFICER)) {
      return acr.reportingOfficerId === user.id && acr.currentHolderId === user.id;
    }

    if (hasRole(user, UserRole.COUNTERSIGNING_OFFICER)) {
      return acr.countersigningOfficerId === user.id && acr.currentHolderId === user.id;
    }

    return false;
  }

  if (action === "complete_secret_branch_review") {
    return isSecretBranchVerifier(user) && acr.currentHolderId === user.id;
  }

  if (action === "verify_secret_branch") {
    return hasSecretBranchAccess(user) && acr.currentHolderId === user.id;
  }

  if (action === "return_to_clerk") {
    return (
      (hasRole(user, UserRole.REPORTING_OFFICER) && acr.reportingOfficerId === user.id && acr.currentHolderId === user.id) ||
      (hasRole(user, UserRole.COUNTERSIGNING_OFFICER) && acr.countersigningOfficerId === user.id && acr.currentHolderId === user.id) ||
      (hasSecretBranchAccess(user) && acr.currentHolderId === user.id)
    );
  }

  if (action === "return_to_reporting") {
    return (
      (hasRole(user, UserRole.COUNTERSIGNING_OFFICER) && acr.countersigningOfficerId === user.id && acr.currentHolderId === user.id) ||
      (hasSecretBranchAccess(user) && acr.currentHolderId === user.id)
    );
  }

  if (action === "return_to_countersigning") {
    return hasSecretBranchAccess(user) && acr.currentHolderId === user.id && Boolean(acr.countersigningOfficerId);
  }

  return false;
}

export function canEditAcrForm(user: ScopedUser, acr: AcrScopeRecord) {
  if (hasAdministrativeBypass(user)) {
    return true;
  }

  if (hasRole(user, UserRole.CLERK)) {
    return acr.currentHolderId === user.id
      && (acr.workflowState === AcrWorkflowState.DRAFT || acr.workflowState === AcrWorkflowState.RETURNED_TO_CLERK);
  }

  if (hasRole(user, UserRole.REPORTING_OFFICER)) {
    return acr.reportingOfficerId === user.id
      && acr.currentHolderId === user.id
      && (acr.workflowState === AcrWorkflowState.PENDING_REPORTING || acr.workflowState === AcrWorkflowState.RETURNED_TO_REPORTING);
  }

  if (hasRole(user, UserRole.COUNTERSIGNING_OFFICER)) {
    return acr.countersigningOfficerId === user.id
      && acr.currentHolderId === user.id
      && (acr.workflowState === AcrWorkflowState.PENDING_COUNTERSIGNING || acr.workflowState === AcrWorkflowState.RETURNED_TO_COUNTERSIGNING);
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
  return USER_ADMIN_ROLES.includes(user.activeRole) || isSecretBranchManager(user);
}

export function displayRole(role: string) {
  if (role === UserRole.DG || role === "DG") {
    return "DG";
  }

  if (role === UserRole.EXECUTIVE_VIEWER || role === "EXECUTIVE_VIEWER") {
    return "DG Viewer";
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
