"use client";

import type {
  AcrAssetKind,
  AcrDetail,
  AcrFormData,
  AcrSummary,
  ApiListResponse,
  AuthChallengeResponse,
  AuthLoginResult,
  AuditEvent,
  AuditListResponse,
  DashboardOverview,
  EmployeeSummary,
  ManualEmployeeOptions,
  ManualEmployeePayload,
  NotificationItem,
  TemplateDescriptor,
  UserDisplayPreferences,
  UserNotificationPreferences,
  UserRoleCode,
  UserSecurityPreferencesInput,
  UserSession,
  UserSettings,
  UploadedFileAsset,
} from "@/types/contracts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

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
  const errorText = await response.text();

  if (errorText) {
    try {
      const parsed = JSON.parse(errorText) as { message?: string | string[] };
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
      response = await rawFetch(path, init);
    } catch {
      response = await rawFetch(path, init);
    }
  }

  if (!response.ok) {
    await readError(response);
  }

  return response.json();
}

function toAbsoluteApiUrl(path: string) {
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

export function getAcrDetail(id: string) {
  return apiFetch<AcrDetail>(`/acrs/${id}`);
}

export function createAcr(payload: {
  employeeId: string;
  reportingPeriodFrom: string;
  reportingPeriodTo: string;
  isPriority?: boolean;
  formData?: AcrFormData;
}) {
  return apiFetch<AcrSummary>("/acrs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function transitionAcr(id: string, payload: { action: string; remarks?: string }) {
  return apiFetch<AcrSummary>(`/acrs/${id}/transition`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAcrFormData(id: string, formData: AcrFormData) {
  return apiFetch<AcrDetail>(`/acrs/${id}/form-data`, {
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
  return apiFetch<ApiListResponse<EmployeeSummary>>(`/employees${suffix}`);
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
  return apiFetch<Array<{
    id: string;
    name: string;
    code: string;
    zones: Array<{
      id: string;
      name: string;
      code: string;
      offices: Array<{ id: string; name: string; code: string; employeeCount: number; userCount: number }>;
    }>;
  }>>("/organization/summary");
}

export function getArchive() {
  return apiFetch<ApiListResponse<AcrDetail>>("/archive");
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

export function getAnalytics() {
  return apiFetch<{
    wingWiseTrends: Array<{ name: string; employees: number; offices: number; acrCount: number }>;
    backlogDistribution: Array<{ name: string; pending: number }>;
  }>("/analytics/leadership");
}
