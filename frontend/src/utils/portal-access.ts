import type { SecretBranchProfileSummary, UserRoleCode } from "@/types/contracts";

type PortalAccessSubject =
  | UserRoleCode
  | {
      activeRoleCode: UserRoleCode;
      secretBranchProfile?: SecretBranchProfileSummary | null;
    };

const COMMON_PORTAL_PREFIXES = ["/profile", "/settings", "/notifications", "/help-support", "/acr"];

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function matchesAnyPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => matchesPrefix(pathname, prefix));
}

export function getDefaultPortalRoute(roleCode: UserRoleCode) {
  switch (roleCode) {
    case "CLERK":
      return "/acr/new";
    case "EMPLOYEE":
      return "/dashboard";
    default:
      return "/dashboard";
  }
}

export function canUseGlobalSearch(roleCode: UserRoleCode) {
  return roleCode !== "CLERK" && roleCode !== "EMPLOYEE";
}

function resolveRoleCode(subject: PortalAccessSubject) {
  return typeof subject === "string" ? subject : subject.activeRoleCode;
}

export function canManageUserAccounts(subject: PortalAccessSubject) {
  const roleCode = resolveRoleCode(subject);

  if (roleCode === "SUPER_ADMIN") {
    return true;
  }

  if (roleCode !== "SECRET_BRANCH" || typeof subject === "string") {
    return false;
  }

  return Boolean(subject.secretBranchProfile?.canManageUsers) && (subject.secretBranchProfile?.isActive ?? true);
}

export function canAccessPortalPath(subject: PortalAccessSubject, pathname: string) {
  const roleCode = resolveRoleCode(subject);

  if (pathname === "/" || pathname === "") {
    return true;
  }

  if (pathname === "/acr/new") {
    return ["CLERK", "SUPER_ADMIN", "IT_OPS", "SECRET_BRANCH"].includes(roleCode);
  }

  if (matchesPrefix(pathname, "/user-management")) {
    return canManageUserAccounts(subject);
  }

  if (pathname === "/form-templates") {
    return roleCode !== "DG";
  }

  if (matchesAnyPrefix(pathname, COMMON_PORTAL_PREFIXES)) {
    return true;
  }

  switch (roleCode) {
    case "CLERK":
      return matchesAnyPrefix(pathname, ["/queue", "/acr/new"]);
    case "REPORTING_OFFICER":
      return matchesAnyPrefix(pathname, ["/dashboard", "/queue", "/search", "/priority", "/overdue", "/review"]);
    case "COUNTERSIGNING_OFFICER":
      return matchesAnyPrefix(pathname, ["/dashboard", "/queue", "/search", "/priority", "/overdue"]);
    case "SECRET_BRANCH":
      return matchesAnyPrefix(pathname, ["/dashboard", "/queue", "/archive", "/search", "/analytics", "/priority", "/overdue", "/audit-logs", "/organization", "/acr/new"]);
    case "SUPER_ADMIN":
    case "IT_OPS":
      return matchesAnyPrefix(pathname, ["/dashboard", "/queue", "/archive", "/search", "/analytics", "/priority", "/overdue", "/audit-logs", "/organization", "/acr/new"]);
    case "DG":
      return matchesAnyPrefix(pathname, ["/dashboard", "/archive", "/search", "/profile", "/settings", "/notifications", "/help-support"]);
    case "EXECUTIVE_VIEWER":
    case "WING_OVERSIGHT":
    case "ZONAL_OVERSIGHT":
      return matchesAnyPrefix(pathname, ["/dashboard", "/queue", "/archive", "/search", "/analytics", "/priority", "/overdue", "/organization", "/audit-logs"]);
    case "EMPLOYEE":
      return matchesAnyPrefix(pathname, ["/dashboard", "/queue", "/archive", "/profile", "/settings", "/notifications", "/help-support", "/acr"]);
    default:
      return false;
  }
}
