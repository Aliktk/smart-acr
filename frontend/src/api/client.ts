"use client";

import type {
  AcrAssetKind,
  AcrDetail,
  AcrFormData,
  AcrSummary,
  AdverseRemarkSummary,
  ApiListResponse,
  ArchiveRecordSource,
  ArchiveRecordSummary,
  AuthChallengeResponse,
  AuthLoginResult,
  AuditEvent,
  AuditListResponse,
  DashboardOverview,
  DashboardAnalyticsResponse,
  DashboardDatePreset,
  EmployeePortalProfile,
  EmployeePortalProfileInput,
  EmployeeSearchResponse,
  EmployeeSummary,
  ManagedUserDetail,
  ManagedUserListResponse,
  ManagedUserSummary,
  CreateManagedUserPayload,
  ManualEmployeeOptions,
  ManualEmployeePayload,
  NotificationItem,
  OrgScopeTrack,
  OrganizationMasterData,
  OrganizationSummaryEntry,
  TemplateDescriptor,
  UpdateEmployeeMetadataPayload,
  UpdateEmployeeProfilePayload,
  UpdateManagedUserPayload,
  UserManagementOptions,
  UserDisplayPreferences,
  UserNotificationPreferences,
  UserAssetType,
  UserRoleCode,
  UserSecurityPreferencesInput,
  UserSession,
  UserSettings,
  UploadedFileAsset,
  SecretBranchDeskCode,
  TemplateFamilyCode,
} from "@/types/contracts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/**
 * Thrown when a session has expired or been revoked beyond recovery.
 * Handled globally in AppProviders — redirects to /login with no console noise.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super("session_expired");
    this.name = "SessionExpiredError";
  }
}

let refreshPromise: Promise<void> | null = null;

function shouldTryRefresh(path: string) {
  return !path.startsWith("/auth/login") &&
    !path.startsWith("/auth/challenge") &&
    !path.startsWith("/auth/verify") &&
    !path.startsWith("/auth/refresh") &&
    !path.startsWith("/auth/logout");
}

async function rawFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers ?? undefined);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
}

async function readError(response: Response) {
  const requestId = response.headers.get("x-request-id") ?? undefined;
  const errorText = await response.text();
  const method = response.url.split("/api/v1").pop() ?? response.url;

  // Log API errors for debugging
  if (typeof window !== "undefined") {
    try {
      const stored = JSON.parse(sessionStorage.getItem("acr_api_errors") ?? "[]") as unknown[];
      stored.push({
        status: response.status,
        path: method,
        requestId,
        message: errorText.slice(0, 200),
        timestamp: new Date().toISOString(),
      });
      if (stored.length > 30) stored.splice(0, stored.length - 30);
      sessionStorage.setItem("acr_api_errors", JSON.stringify(stored));
    } catch {
      // Storage unavailable
    }
  }

  if (errorText) {
    try {
      const parsed = JSON.parse(errorText) as { message?: string | string[]; requestId?: string };
      if (Array.isArray(parsed.message) && parsed.message[0]) {
        throw new Error(parsed.message[0]);
      }

      if (typeof parsed.message === "string" && parsed.message.trim()) {
        throw new Error(parsed.message);
      }
    } catch (error) {
      if (error instanceof Error && error.message !== errorText) {
        throw error;
      }
    }

    throw new Error(errorText);
  }

  throw new Error("Request failed.");
}

async function ensureRefreshed() {
  if (!refreshPromise) {
    refreshPromise = rawFetch("/auth/refresh", { method: "POST" })
      .then(async (response) => {
        if (!response.ok) {
          await readError(response);
        }

        await response.json();
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response = await rawFetch(path, init);

  if (response.status === 401 && shouldTryRefresh(path)) {
    try {
      await ensureRefreshed();
    } catch {
      // Refresh itself failed — session is terminal, redirect to login
      throw new SessionExpiredError();
    }
    response = await rawFetch(path, init);
    if (response.status === 401) {
      // Still 401 after a successful refresh — session is terminal
      throw new SessionExpiredError();
    }
  }

  if (!response.ok) {
    await readError(response);
  }

  return response.json() as Promise<T>;
}

export function toAbsoluteApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export function login(username: string, password: string) {
  return apiFetch<AuthLoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function requestAuthChallenge(username: string, password: string) {
  return apiFetch<AuthLoginResult>("/auth/challenge", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function verifyAuthChallenge(challengeId: string, code: string) {
  return apiFetch<UserSession>("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ challengeId, code }),
  });
}

export function resendAuthChallenge(challengeId: string) {
  return apiFetch<AuthChallengeResponse>("/auth/challenge/resend", {
    method: "POST",
    body: JSON.stringify({ challengeId }),
  });
}

export function logout() {
  return apiFetch<{ success: boolean }>("/auth/logout", { method: "POST" });
}

export function getSession() {
  return apiFetch<UserSession>("/auth/me");
}

export function switchRole(role: UserRoleCode) {
  return apiFetch<UserSession>("/auth/switch-role", {
    method: "POST",
    body: JSON.stringify({ role }),
  });
}

export function requestPasswordReset(identifier: string) {
  return apiFetch<{ success: boolean; message: string; demoResetToken?: string }>("/auth/forgot-password/request", {
    method: "POST",
    body: JSON.stringify({ identifier }),
  });
}

export function resetPasswordWithToken(token: string, nextPassword: string) {
  return apiFetch<{ success: boolean; message: string }>("/auth/forgot-password/reset", {
    method: "POST",
    body: JSON.stringify({ token, nextPassword }),
  });
}

export function getCurrentUserAvatarUrl(avatarVersion?: string | null) {
  const suffix = avatarVersion ? `?v=${encodeURIComponent(avatarVersion)}` : "";
  return `${API_BASE}/settings/profile/avatar${suffix}`;
}

export function getDashboardOverview() {
  return apiFetch<DashboardOverview>("/dashboard/overview");
}

export function getAcrs(filters?: { status?: string; priority?: boolean; query?: string }) {
  const query = new URLSearchParams();
  if (filters?.status) query.set("status", filters.status);
  if (typeof filters?.priority === "boolean") query.set("priority", String(filters.priority));
  if (filters?.query) query.set("query", filters.query);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<ApiListResponse<AcrSummary>>(`/acrs${suffix}`);
}

export function getAcrDetail(id: string, options?: { fresh?: boolean }) {
  const suffix = options?.fresh ? `?_=${Date.now()}` : "";
  return apiFetch<AcrDetail>(`/acrs/${id}${suffix}`, options?.fresh ? { cache: "no-store" } : undefined);
}

export function createAcr(payload: {
  employeeId: string;
  reportingPeriodFrom: string;
  reportingPeriodTo: string;
  isPriority?: boolean;
  formData?: AcrFormData;
  templateFamilyOverride?: TemplateFamilyCode;
}) {
  return apiFetch<AcrSummary>("/acrs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function transitionAcr(id: string, payload: { action: string; remarks?: string; formData?: AcrFormData; targetDeskCode?: SecretBranchDeskCode }) {
  return apiFetch<AcrSummary>(`/acrs/${id}/transition`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAcrFormData(id: string, formData: AcrFormData) {
  return apiFetch<AcrSummary>(`/acrs/${id}/form-data`, {
    method: "PATCH",
    body: JSON.stringify({ formData }),
  });
}

export function uploadAcrAsset(id: string, kind: AcrAssetKind, file: Blob, fileName = "asset.png") {
  const body = new FormData();
  body.append("file", file, fileName);

  return apiFetch<UploadedFileAsset>(`/files/upload?kind=${encodeURIComponent(kind)}&acrRecordId=${encodeURIComponent(id)}`, {
    method: "POST",
    body,
  }).then((asset) => ({
    ...asset,
    contentUrl: `/api/file-assets/${asset.id}`,
  }));
}

export function getEmployees(query?: string) {
  const suffix = query ? `?query=${encodeURIComponent(query)}` : "";
  return apiFetch<EmployeeSearchResponse>(`/employees${suffix}`);
}

export function getManualEmployeeOptions(officeId?: string) {
  const suffix = officeId ? `?officeId=${encodeURIComponent(officeId)}` : "";
  return apiFetch<ManualEmployeeOptions>(`/employees/manual-options${suffix}`);
}

export function createEmployee(payload: ManualEmployeePayload) {
  return apiFetch<EmployeeSummary>("/employees", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateEmployeeStatus(employeeId: string, status: string, retirementDate?: string) {
  return apiFetch<EmployeeSummary>(`/employees/${employeeId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, retirementDate }),
  });
}

export function updateEmployeeMetadata(employeeId: string, payload: UpdateEmployeeMetadataPayload) {
  return apiFetch<EmployeeSummary>(`/employees/${employeeId}/metadata`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getNotifications(filters?: {
  type?: NotificationItem["type"] | "all";
  read?: "read" | "unread" | "all";
  linked?: "linked" | "system" | "all";
  query?: string;
}) {
  const search = new URLSearchParams();
  if (filters?.type && filters.type !== "all") search.set("type", filters.type);
  if (filters?.read && filters.read !== "all") search.set("read", filters.read);
  if (filters?.linked && filters.linked !== "all") search.set("linked", filters.linked);
  if (filters?.query?.trim()) search.set("query", filters.query.trim());
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<ApiListResponse<NotificationItem>>(`/notifications${suffix}`);
}

export function markNotificationRead(id: string) {
  return apiFetch(`/notifications/${id}/read`, { method: "POST" });
}

export function markAllNotificationsRead() {
  return apiFetch<{ success: boolean }>("/notifications/read-all", { method: "POST" });
}

export function dismissNotification(id: string) {
  return apiFetch<{ success: boolean }>(`/notifications/${id}`, { method: "DELETE" });
}

export function getAuditLogs(filters?: {
  page?: number;
  pageSize?: number;
  action?: string;
  actorRole?: string;
  actorName?: string;
  recordQuery?: string;
  dateFrom?: string;
  dateTo?: string;
  module?: AuditEvent["module"] | "all";
  eventType?: AuditEvent["eventType"] | "all";
}) {
  const search = new URLSearchParams();
  if (filters?.page) search.set("page", String(filters.page));
  if (filters?.pageSize) search.set("pageSize", String(filters.pageSize));
  if (filters?.action?.trim()) search.set("action", filters.action.trim());
  if (filters?.actorRole?.trim()) search.set("actorRole", filters.actorRole.trim());
  if (filters?.actorName?.trim()) search.set("actorName", filters.actorName.trim());
  if (filters?.recordQuery?.trim()) search.set("recordQuery", filters.recordQuery.trim());
  if (filters?.dateFrom) search.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) search.set("dateTo", filters.dateTo);
  if (filters?.module && filters.module !== "all") search.set("module", filters.module);
  if (filters?.eventType && filters.eventType !== "all") search.set("eventType", filters.eventType);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<AuditListResponse>(`/audit${suffix}`);
}

export function getOrganizationSummary() {
  return apiFetch<OrganizationSummaryEntry[]>("/organization/summary");
}

export function getOrganizationMasterData() {
  return apiFetch<OrganizationMasterData>("/organization/master-data");
}

export function getArchive() {
  return apiFetch<ApiListResponse<ArchiveRecordSummary>>("/archive/records");
}

export function getArchiveRecords(filters?: {
  query?: string;
  source?: ArchiveRecordSource;
  templateFamily?: string;
  scopeTrack?: OrgScopeTrack;
  wingId?: string;
  directorateId?: string;
  regionId?: string;
  zoneId?: string;
  circleId?: string;
  stationId?: string;
  branchId?: string;
  cellId?: string;
  officeId?: string;
  departmentId?: string;
}) {
  const search = new URLSearchParams();
  if (filters?.query?.trim()) search.set("query", filters.query.trim());
  if (filters?.source) search.set("source", filters.source);
  if (filters?.templateFamily) search.set("templateFamily", filters.templateFamily);
  if (filters?.scopeTrack) search.set("scopeTrack", filters.scopeTrack);
  if (filters?.wingId) search.set("wingId", filters.wingId);
  if (filters?.directorateId) search.set("directorateId", filters.directorateId);
  if (filters?.regionId) search.set("regionId", filters.regionId);
  if (filters?.zoneId) search.set("zoneId", filters.zoneId);
  if (filters?.circleId) search.set("circleId", filters.circleId);
  if (filters?.stationId) search.set("stationId", filters.stationId);
  if (filters?.branchId) search.set("branchId", filters.branchId);
  if (filters?.cellId) search.set("cellId", filters.cellId);
  if (filters?.officeId) search.set("officeId", filters.officeId);
  if (filters?.departmentId) search.set("departmentId", filters.departmentId);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<ApiListResponse<ArchiveRecordSummary>>(`/archive/records${suffix}`);
}

export function getArchiveRecordDetail(id: string) {
  return apiFetch<ArchiveRecordSummary>(`/archive/records/${id}`);
}

export function uploadHistoricalArchive(payload: {
  employeeId: string;
  templateFamily?: string;
  reportingPeriodFrom?: string;
  reportingPeriodTo?: string;
  archiveReference?: string;
  remarks?: string;
  file: File | Blob;
  fileName?: string;
}) {
  const body = new FormData();
  body.append("employeeId", payload.employeeId);
  if (payload.templateFamily) body.append("templateFamily", payload.templateFamily);
  if (payload.reportingPeriodFrom) body.append("reportingPeriodFrom", payload.reportingPeriodFrom);
  if (payload.reportingPeriodTo) body.append("reportingPeriodTo", payload.reportingPeriodTo);
  if (payload.archiveReference) body.append("archiveReference", payload.archiveReference);
  if (payload.remarks) body.append("remarks", payload.remarks);
  body.append("file", payload.file, payload.fileName ?? "historical-acr.pdf");

  return apiFetch<ArchiveRecordSummary>("/archive/historical", {
    method: "POST",
    body,
  });
}

export function updateHistoricalArchiveMetadata(id: string, payload: {
  templateFamily?: string;
  reportingPeriodFrom?: string;
  reportingPeriodTo?: string;
  archiveReference?: string;
  remarks?: string;
}) {
  return apiFetch<ArchiveRecordSummary>(`/archive/historical/${id}/metadata`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function verifyHistoricalArchive(id: string, remarks?: string) {
  return apiFetch<ArchiveRecordSummary>(`/archive/historical/${id}/verify`, {
    method: "POST",
    body: JSON.stringify({ remarks }),
  });
}

export function deleteHistoricalArchive(id: string) {
  return apiFetch<{ success: boolean }>(`/archive/historical/${id}`, {
    method: "DELETE",
  });
}

export function getEmployeeProfile() {
  return apiFetch<EmployeePortalProfile>("/employee/profile");
}

export function updateEmployeePortalProfile(payload: EmployeePortalProfileInput) {
  return apiFetch<EmployeePortalProfile>("/employee/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getEmployeeAcrs() {
  return apiFetch<ApiListResponse<AcrSummary>>("/employee/acrs");
}

export function getEmployeeAcrDetail(id: string) {
  return apiFetch<AcrDetail>(`/employee/acrs/${id}`);
}

export function getTemplates() {
  return apiFetch<ApiListResponse<TemplateDescriptor>>("/templates");
}

export function getSettings() {
  return apiFetch<Array<{ id: string; key: string; value: unknown }>>("/settings");
}

export function updateSetting(key: string, value: string) {
  return apiFetch("/settings", {
    method: "PATCH",
    body: JSON.stringify({ key, value }),
  });
}

export function getUserSettings() {
  return apiFetch<UserSettings>("/settings/me");
}

export function updateUserProfile(payload: { displayName: string; email: string }) {
  return apiFetch<UserSettings>("/settings/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function uploadUserProfileAvatar(file: File) {
  const body = new FormData();
  body.append("file", file);

  return apiFetch<UserSettings>("/settings/profile/avatar", {
    method: "POST",
    body,
  });
}

export function uploadUserProfileAsset(assetType: UserAssetType, file: File) {
  const body = new FormData();
  body.append("file", file);

  return apiFetch<{ id: string }>(`/user-assets/me/${assetType}`, {
    method: "POST",
    body,
  }).then(() => getUserSettings());
}

export function removeUserProfileAsset(assetType: UserAssetType) {
  return apiFetch<{ removed: boolean }>(`/user-assets/me/${assetType}`, {
    method: "DELETE",
  }).then(() => getUserSettings());
}

export function getUserAssetContentUrl(assetId: string, options?: { acrId?: string | null }) {
  const search = new URLSearchParams();
  if (options?.acrId) {
    search.set("acrId", options.acrId);
  }

  const suffix = search.toString() ? `?${search.toString()}` : "";
  return `/api/user-assets/${assetId}${suffix}`;
}

export function updateUserSettingsPreferences(payload: {
  notifications?: UserNotificationPreferences;
  display?: UserDisplayPreferences;
  security?: UserSecurityPreferencesInput;
}) {
  return apiFetch<UserSettings>("/settings/preferences", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updateUserPassword(payload: { currentPassword: string; nextPassword: string }) {
  return apiFetch<{ success: boolean; message: string }>("/settings/security/password", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updateUserEmployeeProfile(payload: UpdateEmployeeProfilePayload) {
  return apiFetch<UserSettings>("/settings/employee-profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getManagedUsers(filters?: {
  page?: number;
  pageSize?: number;
  query?: string;
  role?: UserRoleCode;
  status?: "active" | "inactive";
  scopeTrack?: OrgScopeTrack;
  wingId?: string;
  directorateId?: string;
  regionId?: string;
  zoneId?: string;
  circleId?: string;
  stationId?: string;
  branchId?: string;
  cellId?: string;
  officeId?: string;
  departmentId?: string;
}) {
  const search = new URLSearchParams();
  if (filters?.page) search.set("page", String(filters.page));
  if (filters?.pageSize) search.set("pageSize", String(filters.pageSize));
  if (filters?.query?.trim()) search.set("query", filters.query.trim());
  if (filters?.role) search.set("role", filters.role);
  if (filters?.status) search.set("status", filters.status);
  if (filters?.scopeTrack) search.set("scopeTrack", filters.scopeTrack);
  if (filters?.wingId) search.set("wingId", filters.wingId);
  if (filters?.directorateId) search.set("directorateId", filters.directorateId);
  if (filters?.regionId) search.set("regionId", filters.regionId);
  if (filters?.zoneId) search.set("zoneId", filters.zoneId);
  if (filters?.circleId) search.set("circleId", filters.circleId);
  if (filters?.stationId) search.set("stationId", filters.stationId);
  if (filters?.branchId) search.set("branchId", filters.branchId);
  if (filters?.cellId) search.set("cellId", filters.cellId);
  if (filters?.officeId) search.set("officeId", filters.officeId);
  if (filters?.departmentId) search.set("departmentId", filters.departmentId);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<ManagedUserListResponse>(`/users${suffix}`);
}

export function getUserManagementOptions() {
  return apiFetch<UserManagementOptions>("/users/options");
}

export function getManagedUserDetail(id: string) {
  return apiFetch<ManagedUserDetail>(`/users/${id}`);
}

export function createManagedUser(payload: CreateManagedUserPayload) {
  return apiFetch<ManagedUserSummary>("/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateManagedUser(id: string, payload: UpdateManagedUserPayload) {
  return apiFetch<ManagedUserSummary>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function resetManagedUserPassword(id: string, payload: { nextPassword: string; mustChangePassword?: boolean }) {
  return apiFetch<{ success: boolean; message: string }>(`/users/${id}/reset-password`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deactivateManagedUser(id: string) {
  return apiFetch<ManagedUserSummary>(`/users/${id}/deactivate`, {
    method: "POST",
  });
}

export function reactivateManagedUser(id: string) {
  return apiFetch<ManagedUserSummary>(`/users/${id}/reactivate`, {
    method: "POST",
  });
}

export function getAnalytics() {
  return apiFetch<{
    wingWiseTrends: Array<{ name: string; employees: number; offices: number; acrCount: number }>;
    backlogDistribution: Array<{ name: string; pending: number }>;
  }>("/analytics/leadership");
}

export function getDashboardAnalytics(filters?: {
  datePreset?: DashboardDatePreset;
  scopeTrack?: OrgScopeTrack;
  wingId?: string;
  directorateId?: string;
  regionId?: string;
  zoneId?: string;
  circleId?: string;
  stationId?: string;
  branchId?: string;
  cellId?: string;
  officeId?: string;
  departmentId?: string;
  status?: string;
  templateFamily?: string;
}) {
  const search = new URLSearchParams();
  if (filters?.datePreset) search.set("datePreset", filters.datePreset);
  if (filters?.scopeTrack) search.set("scopeTrack", filters.scopeTrack);
  if (filters?.wingId) search.set("wingId", filters.wingId);
  if (filters?.directorateId) search.set("directorateId", filters.directorateId);
  if (filters?.regionId) search.set("regionId", filters.regionId);
  if (filters?.zoneId) search.set("zoneId", filters.zoneId);
  if (filters?.circleId) search.set("circleId", filters.circleId);
  if (filters?.stationId) search.set("stationId", filters.stationId);
  if (filters?.branchId) search.set("branchId", filters.branchId);
  if (filters?.cellId) search.set("cellId", filters.cellId);
  if (filters?.officeId) search.set("officeId", filters.officeId);
  if (filters?.departmentId) search.set("departmentId", filters.departmentId);
  if (filters?.status) search.set("status", filters.status);
  if (filters?.templateFamily) search.set("templateFamily", filters.templateFamily);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<DashboardAnalyticsResponse>(`/analytics/dashboard${suffix}`);
}

// --- Reference Data ---

export function getReferencePostings() {
  return apiFetch<string[]>("/settings/reference/postings");
}

export function getReferenceZonesCircles() {
  return apiFetch<string[]>("/settings/reference/zones-circles");
}

// --- Adverse Remarks ---

export function getAdverseRemarks(acrId: string) {
  return apiFetch<AdverseRemarkSummary[]>(`/acrs/${acrId}/adverse-remarks`);
}

export function createAdverseRemark(acrId: string, payload: { remarkText: string; counsellingDate?: string; counsellingNotes?: string }) {
  return apiFetch<AdverseRemarkSummary>(`/acrs/${acrId}/adverse-remarks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function endorseAdverseRemark(acrId: string, remarkId: string) {
  return apiFetch<AdverseRemarkSummary>(`/acrs/${acrId}/adverse-remarks/${remarkId}/endorse`, {
    method: "PATCH",
  });
}

export function acknowledgeAdverseRemark(acrId: string, remarkId: string) {
  return apiFetch<AdverseRemarkSummary>(`/acrs/${acrId}/adverse-remarks/${remarkId}/acknowledge`, {
    method: "PATCH",
  });
}

export function communicateAdverseRemark(acrId: string, remarkId: string) {
  return apiFetch<AdverseRemarkSummary>(`/acrs/${acrId}/adverse-remarks/${remarkId}/communicate`, {
    method: "PATCH",
  });
}

export function submitAdverseRepresentation(acrId: string, remarkId: string, representationText: string) {
  return apiFetch<AdverseRemarkSummary>(`/acrs/${acrId}/adverse-remarks/${remarkId}/representation`, {
    method: "POST",
    body: JSON.stringify({ representationText }),
  });
}

export function decideAdverseRepresentation(acrId: string, remarkId: string, decision: string, decisionNotes: string) {
  return apiFetch<AdverseRemarkSummary>(`/acrs/${acrId}/adverse-remarks/${remarkId}/decide`, {
    method: "PATCH",
    body: JSON.stringify({ decision, decisionNotes }),
  });
}
