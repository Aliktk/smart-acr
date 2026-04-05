export type AcrWorkflowState =
  | "Draft"
  | "Pending Reporting"
  | "Pending Countersigning"
  | "Submitted to Secret Branch"
  | "Archived"
  | "Returned";

export type AcrStatus =
  | "Draft"
  | "Initiated"
  | "In Review"
  | "Pending Reporting Officer"
  | "Pending Countersigning"
  | "Submitted to Secret Branch"
  | "Overdue"
  | "Priority"
  | "Archived"
  | "Returned"
  | "Completed";

export type NotificationType = "info" | "warning" | "success" | "danger";

export type UserRole =
  | "Super Admin"
  | "IT Ops"
  | "Clerk"
  | "Reporting Officer"
  | "Countersigning Officer"
  | "Secret Branch"
  | "Wing Oversight"
  | "Zonal Oversight"
  | "DG"
  | "Executive Viewer"
  | "Employee";

export type UserRoleCode =
  | "SUPER_ADMIN"
  | "IT_OPS"
  | "CLERK"
  | "REPORTING_OFFICER"
  | "COUNTERSIGNING_OFFICER"
  | "SECRET_BRANCH"
  | "WING_OVERSIGHT"
  | "ZONAL_OVERSIGHT"
  | "DG"
  | "EXECUTIVE_VIEWER"
  | "EMPLOYEE";

export type TemplateFamilyCode =
  | "ASSISTANT_UDC_LDC"
  | "APS_STENOTYPIST"
  | "INSPECTOR_SI_ASI"
  | "SUPERINTENDENT_AINCHARGE";

export interface UserScope {
  wingId?: string | null;
  wingName?: string | null;
  zoneId?: string | null;
  zoneName?: string | null;
  officeId?: string | null;
  officeName?: string | null;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  badgeNo: string;
  hasAvatar: boolean;
  avatarVersion: string | null;
  activeRole: UserRole;
  activeRoleCode: UserRoleCode;
  availableRoles: UserRole[];
  availableRoleCodes: UserRoleCode[];
  scope: UserScope;
}

export interface UserNotificationPreferences {
  acrSubmitted: boolean;
  acrReturned: boolean;
  overdueAlerts: boolean;
  priorityAlerts: boolean;
  systemUpdates: boolean;
  weeklyDigest: boolean;
}

export interface UserDisplayPreferences {
  compactSidebar: boolean;
  denseTables: boolean;
  reduceMotion: boolean;
}

export interface UserSecuritySettings {
  twoFactorEnabled: boolean;
  passwordChangedAt: string | null;
}

export interface UserSecurityPreferencesInput {
  twoFactorEnabled: boolean;
}

export interface UserSettingsProfile {
  id: string;
  fullName: string;
  badgeNo: string;
  email: string;
  officeName: string;
  roleLabel: string;
  hasAvatar: boolean;
  avatarVersion: string | null;
}

export interface UserSettings {
  profile: UserSettingsProfile;
  notifications: UserNotificationPreferences;
  display: UserDisplayPreferences;
  security: UserSecuritySettings;
}

export interface AuthChallengeResponse {
  status: "challenge_required";
  challengeId: string;
  expiresInSeconds: number;
  expiresAt: string;
  maskedDestination: string;
  demoCode?: string;
}

export interface AuthenticatedLoginResponse {
  status: "authenticated";
  session: UserSession;
}

export type AuthLoginResult = AuthChallengeResponse | AuthenticatedLoginResponse;

export interface EmployeeSummary {
  id: string;
  serviceNumber?: string;
  name: string;
  rank: string;
  designation?: string;
  bps: number;
  cnic: string;
  mobile: string;
  email: string;
  wing: string;
  zone: string;
  office: string;
  posting: string;
  reportingOfficer?: string | null;
  reportingOfficerDesignation?: string | null;
  countersigningOfficer?: string | null;
  countersigningOfficerDesignation?: string | null;
  joiningDate: string;
  serviceYears: number;
  address: string;
  templateFamily: TemplateFamilyCode;
  avatar?: string;
}

export interface AcrClerkSection {
  periodFrom: string;
  periodTo: string;
  zoneCircle: string;
  directDeputationist: string;
  fatherName: string;
  trainingCourses: string;
  departmentalEnquiry: string;
  punishment: string;
  rewards: string;
  remarks: string;
  isPriority: boolean;
}

export type AcrAssetKind = "SIGNATURE" | "STAMP" | "DOCUMENT";

export interface AcrAssetReference {
  fileId: string;
  url: string;
  fileName?: string;
  mimeType?: string;
  kind?: AcrAssetKind;
}

export interface AcrReplicaState {
  textFields: Record<string, string>;
  checkFields: Record<string, boolean>;
  assetFields: Record<string, AcrAssetReference | string>;
}

export interface AcrFormWorkflowMeta {
  lastEditedAt?: string;
  lastEditedBy?: string;
  lastEditedRole?: UserRole;
}

export interface AcrReviewerInfo {
  name: string;
  designation: string;
}

export interface AcrReviewerContext {
  reporting: AcrReviewerInfo;
  countersigning?: AcrReviewerInfo | null;
}

export interface AcrFormData {
  source?: "manual" | "directory";
  clerkSection?: AcrClerkSection;
  employeeSnapshot?: EmployeeSummary | ManualEmployeePayload | null;
  replicaState?: AcrReplicaState;
  workflowMeta?: AcrFormWorkflowMeta;
}

export interface AcrSummary {
  id: string;
  acrNo: string;
  employee: EmployeeSummary;
  status: AcrStatus;
  workflowState: AcrWorkflowState;
  currentHolderId?: string | null;
  currentHolderName?: string | null;
  currentHolderRole?: string | null;
  reportingPeriod: string;
  initiatedBy: string;
  initiatedDate: string;
  reportingOfficer: string;
  countersigningOfficer: string | null;
  dueDate: string;
  completedDate?: string | null;
  isPriority: boolean;
  isOverdue: boolean;
  overdueDays?: number;
  wing: string;
  reportingOfficerDesignation: string;
  countersigningOfficerDesignation?: string | null;
  remarks?: string;
  performanceScore?: number;
}

export interface UploadedFileAsset {
  id: string;
  kind: AcrAssetKind;
  fileName: string;
  mimeType: string;
  contentUrl: string;
}

export interface TimelineEntry {
  id: string;
  action: string;
  actor: string;
  role: string;
  timestamp: string;
  status: "completed" | "active" | "pending" | "returned";
  remarks?: string;
}

export interface AcrDetail extends AcrSummary {
  timeline: TimelineEntry[];
  templateFamily: TemplateFamilyCode;
  documentVersion: string;
  archiveReference?: string | null;
  formData?: AcrFormData | null;
}

export interface SearchFilters {
  query?: string;
  serviceNumber?: string;
  cnic?: string;
  mobile?: string;
  rank?: string;
  designation?: string;
  office?: string;
  wing?: string;
  zone?: string;
  reportingOfficer?: string;
  countersigningOfficer?: string;
  period?: string;
  status?: AcrStatus;
  priority?: boolean;
}

export interface DashboardMetrics {
  initiatedCount: number;
  pendingCount: number;
  overdueCount: number;
  completedCount: number;
  archivedCount: number;
  priorityCount: number;
  averageCompletionDays: number;
}

export interface DashboardSummary {
  fiscalYearLabel: string;
  totalCount: number;
  draftCount: number;
  submittedCount: number;
  returnedCount: number;
  currentFiscalInitiatedCount: number;
  currentFiscalPendingCount: number;
  currentFiscalCompletedCount: number;
  currentFiscalReturnedCount: number;
  initiatedDeltaPercent: number | null;
  completedDeltaPercent: number | null;
}

export interface DashboardDistributionEntry {
  label: string;
  value: number;
}

export interface DashboardOverview {
  metrics: DashboardMetrics;
  summary: DashboardSummary;
  distribution: DashboardDistributionEntry[];
  items: AcrSummary[];
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  read: boolean;
  acrId?: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  description: string;
  actorId?: string;
  actorName: string;
  actorRole: string;
  performedBy: string;
  role: string;
  recordType: string;
  recordId?: string;
  recordLabel?: string;
  acrId?: string;
  acrNo?: string;
  module: "ACR" | "Authentication" | "Settings" | "Administration" | "System";
  eventType: "create" | "update" | "transition" | "archive" | "authentication" | "system";
  timestamp: string;
  displayTimestamp: string;
  ipAddress: string;
  details: string;
}

export interface AuditListResponse extends ApiListResponse<AuditEvent> {
  page: number;
  pageSize: number;
  totalPages: number;
  facets: {
    actions: string[];
    actorRoles: string[];
    modules: Array<AuditEvent["module"]>;
    eventTypes: Array<AuditEvent["eventType"]>;
  };
}

export interface TemplateDescriptor {
  id: string;
  family: TemplateFamilyCode;
  code: string;
  version: string;
  title: string;
  languageMode: "ENGLISH" | "BILINGUAL";
  requiresCountersigning: boolean;
  pageCount: number;
}

export interface ApiListResponse<T> {
  items: T[];
  total: number;
}

export interface ManualEmployeePayload {
  name: string;
  rank: string;
  designation: string;
  bps: number;
  cnic: string;
  mobile: string;
  email?: string;
  posting: string;
  joiningDate: string;
  address: string;
  templateFamily: TemplateFamilyCode;
  officeId: string;
  reportingOfficerId: string;
  countersigningOfficerId?: string;
}

export interface ManualAssignmentOfficeOption {
  id: string;
  name: string;
  code: string;
  zoneName: string;
  wingName: string;
}

export interface ManualAssignmentOfficerOption {
  id: string;
  displayName: string;
  badgeNo: string;
  officeName?: string | null;
  zoneName?: string | null;
  wingName?: string | null;
  scopeLabel: string;
}

export interface ManualEmployeeOptions {
  offices: ManualAssignmentOfficeOption[];
  reportingOfficers: ManualAssignmentOfficerOption[];
  countersigningOfficers: ManualAssignmentOfficerOption[];
}
