import type { UserRoleCode } from "@/types/contracts";

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
      return "/queue";
    default:
      return "/dashboard";
  }
}

export function canUseGlobalSearch(roleCode: UserRoleCode) {
  return roleCode !== "CLERK";
}

export function canAccessPortalPath(roleCode: UserRoleCode, pathname: string) {
  if (pathname === "/" || pathname === "") {
    return true;
  }

  if (pathname === "/acr/new") {
    return ["CLERK", "SUPER_ADMIN", "IT_OPS"].includes(roleCode);
  }

  if (pathname === "/user-management") {
    return ["SUPER_ADMIN", "IT_OPS"].includes(roleCode);
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
      return matchesAnyPrefix(pathname, ["/dashboard", "/archive", "/search", "/analytics", "/audit-logs", "/organization"]);
    case "SUPER_ADMIN":
    case "IT_OPS":
      return matchesAnyPrefix(pathname, ["/dashboard", "/queue", "/archive", "/search", "/analytics", "/priority", "/overdue", "/audit-logs", "/organization", "/acr/new", "/user-management"]);
    case "DG":
      return matchesAnyPrefix(pathname, ["/dashboard", "/archive", "/search", "/profile", "/settings", "/notifications", "/help-support"]);
    case "EXECUTIVE_VIEWER":
    case "WING_OVERSIGHT":
    case "ZONAL_OVERSIGHT":
      return matchesAnyPrefix(pathname, ["/dashboard", "/queue", "/archive", "/search", "/analytics", "/priority", "/overdue", "/organization", "/audit-logs"]);
    case "EMPLOYEE":
      return matchesAnyPrefix(pathname, ["/dashboard", "/queue", "/search"]);
    default:
      return false;
  }
}
