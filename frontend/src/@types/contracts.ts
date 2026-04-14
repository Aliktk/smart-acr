export type AcrWorkflowState =
  | "Draft"
  | "Pending Admin Office Forwarding"
  | "Pending Secret Cell Intake"
  | "Pending Reporting"
  | "Pending Countersigning"
  | "Pending Secret Branch Review"
  | "Pending Secret Branch Verification"
  | "Submitted to Secret Branch"
  | "Returned to Clerk"
  | "Returned to Reporting Officer"
  | "Returned to Countersigning Officer"
  | "Returned to Admin Office"
  | "Archived"
  | "Returned";

export type AcrStatus =
  | "Draft"
  | "Initiated"
  | "In Review"
  | "Pending Reporting Officer"
  | "Pending Countersigning"
  | "Pending Countersigning Officer"
  | "Pending Secret Branch Review"
  | "Pending Secret Branch Verification"
  | "Submitted to Secret Branch"
  | "Overdue"
  | "Priority"
  | "Returned to Clerk"
  | "Returned to Reporting Officer"
  | "Returned to Countersigning Officer"
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
  | "DG Viewer"
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
  | "SUPERINTENDENT_AINCHARGE"
  | "CAR_DRIVERS_DESPATCH_RIDERS"
  | "PER_17_18_OFFICERS";

export type SecretBranchDeskCode = "AD_SECRET_BRANCH" | "DA1" | "DA2" | "DA3" | "DA4";

export type ArchiveRecordSource = "WORKFLOW_FINAL" | "HISTORICAL_UPLOAD";
export type OrgScopeTrack = "REGIONAL" | "WING";
export type UserAssetType = "SIGNATURE" | "STAMP";
export type FileStorageType = "LOCAL";
export type EmployeeStatus = "ACTIVE" | "SUSPENDED" | "AWAITING_POSTING" | "RETIRED";
export type AdverseRemarkStatus = "DRAFT" | "ENDORSED_BY_CSO" | "COMMUNICATED" | "ACKNOWLEDGED" | "REPRESENTATION_RECEIVED" | "REPRESENTATION_DECIDED";
export type Gender = "MALE" | "FEMALE" | "OTHER";
export type EducationLevel =
  | "BELOW_MATRIC"
  | "MATRIC"
  | "INTERMEDIATE"
  | "DIPLOMA"
  | "BA_BSC"
  | "BS_HONORS"
  | "MA_MSC"
  | "MS_MPHIL"
  | "PHD"
  | "OTHER";
export type DeputationType = "DIRECT" | "DEPUTATIONIST";
export type DisciplinaryRecordType = "ENQUIRY" | "MAJOR_PUNISHMENT" | "MINOR_PUNISHMENT";
export type RewardType = "REWARD" | "COMMENDATION_CERTIFICATE" | "LETTER_OF_APPRECIATION";
export type LanguageProficiencyLevel = "NONE" | "BASIC" | "GOOD" | "EXCELLENT";

export interface EmployeeTrainingCourse {
  id: string;
  courseName: string;
  durationFrom: string | null;
  durationTo: string | null;
  institution: string | null;
  country: string | null;
}

export interface EmployeeDisciplinaryRecord {
  id: string;
  type: DisciplinaryRecordType;
  description: string;
  year: number | null;
  outcome: string | null;
  awardedDate: string | null;
}

export interface EmployeeReward {
  id: string;
  type: RewardType;
  description: string;
  awardedDate: string | null;
  awardedBy: string | null;
}

export interface EmployeeLanguageProficiency {
  id: string;
  language: string;
  speaking: LanguageProficiencyLevel;
  reading: LanguageProficiencyLevel;
  writing: LanguageProficiencyLevel;
}

export interface AdverseRemarkSummary {
  id: string;
  acrRecordId: string;
  remarkText: string;
  counsellingDate: string | null;
  counsellingNotes: string | null;
  endorsedByCso: boolean;
  endorsedAt: string | null;
  communicatedAt: string | null;
  communicationDeadline: string | null;
  acknowledgedAt: string | null;
  status: AdverseRemarkStatus;
  createdAt: string;
  representation: {
    id: string;
    representationText: string;
    receivedAt: string;
    representationDeadline: string;
    decision: string | null;
    decisionDate: string | null;
    decisionNotes: string | null;
    decidedByName: string | null;
  } | null;
}

export interface SecretBranchProfileSummary {
  deskCode: SecretBranchDeskCode;
  canManageUsers: boolean;
  canVerify: boolean;
  isActive: boolean;
}

export interface UserScope {
  scopeTrack?: OrgScopeTrack | null;
  wingId?: string | null;
  wingName?: string | null;
  directorateId?: string | null;
  directorateName?: string | null;
  regionId?: string | null;
  regionName?: string | null;
  zoneId?: string | null;
  zoneName?: string | null;
  circleId?: string | null;
  circleName?: string | null;
  stationId?: string | null;
  stationName?: string | null;
  branchId?: string | null;
  branchName?: string | null;
  cellId?: string | null;
  cellName?: string | null;
  officeId?: string | null;
  officeName?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
}

export interface UserSession {
  id: string;
  name: string;
  email: string;
  badgeNo: string;
  positionTitle?: string | null;
  hasAvatar: boolean;
  avatarVersion: string | null;
  activeRole: UserRole;
  activeRoleCode: UserRoleCode;
  availableRoles: UserRole[];
  availableRoleCodes: UserRoleCode[];
  scope: UserScope;
  secretBranchProfile?: SecretBranchProfileSummary | null;
  mustChangePassword: boolean;
}

export type ManagedUserStatus = "active" | "inactive";

export interface ManagedUserSummary {
  id: string;
  fullName: string;
  username: string;
  email: string;
  badgeNo: string;
  mobileNumber?: string | null;
  cnic?: string | null;
  positionTitle?: string | null;
  departmentName?: string | null;
  status: ManagedUserStatus;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  scope: {
    scopeTrack?: OrgScopeTrack | null;
    wingId?: string | null;
    wingName?: string | null;
    directorateId?: string | null;
    directorateName?: string | null;
    regionId?: string | null;
    regionName?: string | null;
    zoneId?: string | null;
    zoneName?: string | null;
    circleId?: string | null;
    circleName?: string | null;
    stationId?: string | null;
    stationName?: string | null;
    branchId?: string | null;
    branchName?: string | null;
    cellId?: string | null;
    cellName?: string | null;
    officeId?: string | null;
    officeName?: string | null;
    departmentId?: string | null;
    departmentName?: string | null;
  };
  secretBranchProfile?: SecretBranchProfileSummary | null;
  roles: UserRoleCode[];
  roleLabels: string[];
}

export interface ManagedUserAuditEntry {
  id: string;
  action: string;
  actorName: string;
  actorRole: string;
  details: string;
  createdAt: string;
}

export interface ManagedUserDetail extends ManagedUserSummary {
  recentAudit: ManagedUserAuditEntry[];
}

export interface ManagedUserListResponse extends ApiListResponse<ManagedUserSummary> {
  page: number;
  pageSize: number;
  totalPages: number;
  filters: {
    activeAdmin: string;
  };
}

export interface UserManagementOptions {
  roles: Array<{ code: UserRoleCode; label: string }>;
  secretBranchDeskCodes: Array<{ code: SecretBranchDeskCode; label: string }>;
  wings: Array<{ id: string; name: string; code: string }>;
  directorates: Array<{ id: string; name: string; code: string; wingId: string }>;
  regions: Array<{ id: string; name: string; code: string; wingId?: string | null; directorateId?: string | null }>;
  zones: Array<{ id: string; name: string; code: string; wingId?: string | null; regionId?: string | null }>;
  circles: Array<{ id: string; name: string; code: string; wingId?: string | null; regionId?: string | null; zoneId: string }>;
  stations: Array<{ id: string; name: string; code: string; wingId?: string | null; regionId?: string | null; zoneId: string; circleId?: string | null }>;
  branches: Array<{ id: string; name: string; code: string; wingId?: string | null; regionId?: string | null; zoneId: string; circleId?: string | null; stationId?: string | null }>;
  cells: Array<{ id: string; name: string; code: string; wingId?: string | null; regionId?: string | null; zoneId: string; circleId?: string | null; stationId?: string | null; branchId?: string | null }>;
  offices: Array<{
    id: string;
    name: string;
    code: string;
    scopeTrack: OrgScopeTrack;
    wingId?: string | null;
    directorateId?: string | null;
    regionId?: string | null;
    zoneId?: string | null;
    circleId?: string | null;
    stationId?: string | null;
    branchId?: string | null;
    cellId?: string | null;
  }>;
  departments: Array<{ id: string; name: string; code: string; officeId: string }>;
}

export interface ManagedUserScopeInput {
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
  departmentName?: string;
}

export interface SecretBranchProfileInput {
  deskCode?: SecretBranchDeskCode;
  canManageUsers?: boolean;
  canVerify?: boolean;
  isActive?: boolean;
}

export interface CreateManagedUserPayload {
  fullName: string;
  username: string;
  email: string;
  badgeNo: string;
  mobileNumber?: string;
  cnic?: string;
  positionTitle?: string;
  temporaryPassword: string;
  roles: UserRoleCode[];
  isActive?: boolean;
  mustChangePassword?: boolean;
  scope: ManagedUserScopeInput;
  secretBranchProfile?: SecretBranchProfileInput;
}

export interface UpdateManagedUserPayload {
  fullName?: string;
  username?: string;
  email?: string;
  badgeNo?: string;
  mobileNumber?: string;
  cnic?: string | null;
  positionTitle?: string | null;
  roles?: UserRoleCode[];
  isActive?: boolean;
  mustChangePassword?: boolean;
  scope?: ManagedUserScopeInput;
  secretBranchProfile?: SecretBranchProfileInput;
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
  signatureAsset: UserProfileAsset | null;
  stampAsset: UserProfileAsset | null;
}

export interface UserSettingsEmployeeProfile {
  isLinked: boolean;
  id: string;
  name: string;
  rank: string;
  designation: string;
  bps: number;
  posting: string;
  mobile: string;
  joiningDate: string;
  serviceYears: number;
  gender: Gender | null;
  dateOfBirth: string | null;
  basicPay: number | null;
  appointmentToBpsDate: string | null;
  educationLevel: EducationLevel | null;
  qualifications: string | null;
  fatherName: string | null;
  spouseName: string | null;
  deputationType: DeputationType | null;
  natureOfDuties: string | null;
  personnelNumber: string | null;
  serviceGroup: string | null;
  licenseType: string | null;
  vehicleType: string | null;
  trainingCoursesText: string | null;
  trainingCourses: EmployeeTrainingCourse[];
  languages: EmployeeLanguageProficiency[];
}

export interface UpdateEmployeeProfilePayload {
  gender?: Gender;
  dateOfBirth?: string;
  joiningDate?: string;
  fatherName?: string;
  spouseName?: string;
  mobile?: string;
  basicPay?: number;
  appointmentToBpsDate?: string;
  educationLevel?: EducationLevel;
  qualifications?: string;
  deputationType?: DeputationType;
  natureOfDuties?: string;
  personnelNumber?: string;
  serviceGroup?: string;
  licenseType?: string;
  vehicleType?: string;
  trainingCoursesText?: string;
  trainingCourses?: Array<{
    courseName: string;
    durationFrom?: string;
    durationTo?: string;
    institution?: string;
    country?: string;
  }>;
  languages?: Array<{
    language: string;
    speaking: LanguageProficiencyLevel;
    reading: LanguageProficiencyLevel;
    writing: LanguageProficiencyLevel;
  }>;
}

export interface UserSettings {
  profile: UserSettingsProfile;
  employeeProfile: UserSettingsEmployeeProfile;
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
  positionTitle?: string | null;
  bps: number;
  cnic: string;
  mobile: string;
  email: string;
  scopeTrack?: OrgScopeTrack | null;
  wingId?: string | null;
  wing?: string | null;
  directorateId?: string | null;
  directorate?: string | null;
  regionId?: string | null;
  region?: string | null;
  zoneId?: string | null;
  zone?: string | null;
  circleId?: string | null;
  circle?: string | null;
  stationId?: string | null;
  station?: string | null;
  branchId?: string | null;
  branch?: string | null;
  cellId?: string | null;
  cell?: string | null;
  officeId?: string | null;
  office?: string | null;
  departmentId?: string | null;
  department?: string | null;
  orgLabel?: string | null;
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
  // metadata fields
  gender?: Gender | null;
  dateOfBirth?: string | null;
  basicPay?: number | null;
  appointmentToBpsDate?: string | null;
  educationLevel?: EducationLevel | null;
  qualifications?: string | null;
  fatherName?: string | null;
  deputationType?: DeputationType | null;
  natureOfDuties?: string | null;
  personnelNumber?: string | null;
  serviceGroup?: string | null;
  licenseType?: string | null;
  vehicleType?: string | null;
  trainingCoursesText?: string | null;
  trainingCourses?: EmployeeTrainingCourse[];
  disciplinaryRecords?: EmployeeDisciplinaryRecord[];
  rewards?: EmployeeReward[];
  languages?: EmployeeLanguageProficiency[];
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
  fileId?: string;
  url: string;
  fileName?: string;
  mimeType?: string;
  kind?: AcrAssetKind;
}

export interface UserProfileAsset {
  id: string;
  assetType: UserAssetType;
  storageType: FileStorageType;
  fileName: string;
  mimeType: string;
  fileSize: number;
  updatedAt: string;
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
  signatureAsset?: UserProfileAsset | null;
  stampAsset?: UserProfileAsset | null;
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
  reportingPeriodFrom?: string | null;
  reportingPeriodTo?: string | null;
  servicePeriodKey?: string | null;
  servicePeriodLabel?: string | null;
  reportingYearStart?: number | null;
  reportingYearEnd?: number | null;
  initiatedBy: string;
  initiatedDate: string;
  submittedToReportingAt?: string | null;
  forwardedToCountersigningAt?: string | null;
  reportingOfficer: string;
  countersigningOfficer: string | null;
  dueDate: string;
  completedDate?: string | null;
  archivedAt?: string | null;
  hasHistoricalPdf?: boolean;
  isPriority: boolean;
  isOverdue: boolean;
  overdueDays?: number;
  hasAdverseRemarks?: boolean;
  calendarYear?: number | null;
  gradeDueDate?: string | null;
  wing: string;
  reportingOfficerDesignation: string;
  countersigningOfficerDesignation?: string | null;
  remarks?: string;
  performanceScore?: number;
  templateFamily?: TemplateFamilyCode;
  documentVersion?: string;
  secretBranch?: {
    deskCode?: SecretBranchDeskCode | null;
    allocatedTo?: string | null;
    verifiedBy?: string | null;
    submittedAt?: string | null;
    reviewedAt?: string | null;
    verifiedAt?: string | null;
    verificationNotes?: string | null;
    status?: string | null;
  };
  reviewerAssets?: {
    reporting: {
      signature: UserProfileAsset | null;
      stamp: UserProfileAsset | null;
    };
    countersigning?: {
      signature: UserProfileAsset | null;
      stamp: UserProfileAsset | null;
    } | null;
  };
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
  employeeMetadataSnapshot?: Record<string, unknown> | null;
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
  rectificationReturnsCount?: number;
  adversePendingCount?: number;
  intakeIssuesCount?: number;
  secretCellPendingIntake?: number;
  pendingAdminForwarding?: number;
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

export interface RetirementWarning {
  employeeId: string;
  employeeName: string;
  designation: string;
  bps: number;
  retirementDate: string;
  daysUntilRetirement: number;
  pendingAcrCount: number;
  message: string;
}

export interface DashboardOverview {
  metrics: DashboardMetrics;
  summary: DashboardSummary;
  distribution: DashboardDistributionEntry[];
  items: AcrSummary[];
  retirementWarnings?: RetirementWarning[];
}

export type DashboardDatePreset = "30d" | "90d" | "180d" | "365d" | "fy" | "all";

export type DashboardTone = "navy" | "cyan" | "green" | "amber" | "red" | "slate";

export interface DashboardAnalyticsAppliedFilters {
  datePreset: DashboardDatePreset;
  dateLabel: string;
  scopeTrack: OrgScopeTrack | "";
  wingId: string;
  directorateId: string;
  regionId: string;
  zoneId: string;
  circleId: string;
  stationId: string;
  branchId: string;
  cellId: string;
  officeId: string;
  departmentId: string;
  status: string;
  templateFamily: TemplateFamilyCode | "";
}

export interface DashboardAnalyticsFilterOptions {
  datePresets: Array<{ value: DashboardDatePreset; label: string }>;
  scopeTracks: Array<{ value: OrgScopeTrack; label: string }>;
  wings: Array<{ id: string; label: string }>;
  directorates: Array<{ id: string; label: string; wingId?: string | null }>;
  regions: Array<{ id: string; label: string; wingId?: string | null; directorateId?: string | null }>;
  zones: Array<{ id: string; label: string; wingId?: string | null; regionId?: string | null }>;
  circles: Array<{ id: string; label: string; regionId?: string | null; zoneId: string }>;
  stations: Array<{ id: string; label: string; zoneId: string; circleId?: string | null }>;
  branches: Array<{ id: string; label: string; zoneId: string; stationId?: string | null; circleId?: string | null }>;
  cells: Array<{ id: string; label: string; zoneId: string; branchId?: string | null; stationId?: string | null }>;
  offices: Array<{ id: string; label: string; scopeTrack: OrgScopeTrack; wingId?: string | null; directorateId?: string | null; regionId?: string | null; zoneId?: string | null }>;
  departments: Array<{ id: string; label: string; officeId: string }>;
  statuses: Array<{ value: string; label: string }>;
  templateFamilies: Array<{ value: TemplateFamilyCode; label: string }>;
}

export interface DashboardKpi {
  key: string;
  label: string;
  value: string | number;
  helper: string;
  tone: DashboardTone;
}

export interface DashboardTrendPoint {
  key: string;
  label: string;
  initiated: number;
  pending: number;
  completed: number;
  overdue: number;
  archived: number;
  cumulativeArchived: number;
  receivedFromReporting: number;
  receivedFromCountersigning: number;
  returnedBeforeArchive: number;
  downloads: number;
  anomalies: number;
}

export interface DashboardTrendSeriesMeta {
  key: keyof DashboardTrendPoint | string;
  label: string;
  color: DashboardTone;
}

export interface DashboardTrendCard {
  title: string;
  subtitle: string;
  points: DashboardTrendPoint[];
  series: DashboardTrendSeriesMeta[];
  defaultSeries: string[];
}

export interface DashboardPerformanceEntry {
  id: string;
  label: string;
  total: number;
  pending?: number;
  completed?: number;
  overdue?: number;
  returned?: number;
  completionRate?: number;
  avgTurnaroundDays?: number;
  rate?: number;
  archived?: number;
  anomalies?: number;
  downloads?: number;
}

export interface DashboardTurnaroundEntry {
  key: string;
  label: string;
  avgDays: number;
}

export interface DashboardDistributionItem {
  key: string;
  label: string;
  value: number;
  filterValue?: string;
}

export interface DashboardHeatmapColumn {
  key: string;
  label: string;
}

export interface DashboardHeatmapRow {
  id: string;
  label: string;
  values: Record<string, number>;
  completionRate: number;
  overdue: number;
  total: number;
  completed: number;
}

export interface DashboardHeatmap {
  title: string;
  subtitle: string;
  columns: DashboardHeatmapColumn[];
  rows: DashboardHeatmapRow[];
}

export interface DashboardAnalyticsResponse {
  mode: "executive" | "secret-branch";
  heading: {
    eyebrow: string;
    title: string;
    description: string;
  };
  appliedFilters: DashboardAnalyticsAppliedFilters;
  filterOptions: DashboardAnalyticsFilterOptions;
  kpis: DashboardKpi[];
  trends: {
    workload: DashboardTrendCard;
    archive: DashboardTrendCard;
  };
  performance: {
    wing: DashboardPerformanceEntry[];
    region: DashboardPerformanceEntry[];
    zone: DashboardPerformanceEntry[];
    offices: DashboardPerformanceEntry[];
    turnaroundByStage: DashboardTurnaroundEntry[];
  };
  distributions: {
    status: DashboardDistributionItem[];
    template: DashboardDistributionItem[];
    returnRateByWing: DashboardPerformanceEntry[];
    sourceFlow?: DashboardDistributionItem[];
  };
  heatmap: DashboardHeatmap | null;
  focus: {
    title: string;
    subtitle: string;
    items: AcrSummary[];
  };
  benchmarks?: {
    previousPeriodCompleted: number;
    previousPeriodOverdue: number;
  };
  generatedAt: string;
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

export interface UnlinkedUserMetadata {
  gender?: Gender | null;
  dateOfBirth?: string | null;
  joiningDate?: string | null;
  fatherName?: string | null;
  spouseName?: string | null;
  mobile?: string | null;
  basicPay?: number | null;
  appointmentToBpsDate?: string | null;
  educationLevel?: EducationLevel | null;
  qualifications?: string | null;
  deputationType?: DeputationType | null;
  natureOfDuties?: string | null;
  personnelNumber?: string | null;
  serviceGroup?: string | null;
  licenseType?: string | null;
  vehicleType?: string | null;
  trainingCoursesText?: string | null;
}

export interface UnlinkedUserSummary {
  id: string;
  displayName: string;
  email: string;
  badgeNo: string;
  mobileNumber: string | null;
  cnic?: string | null;
  departmentId?: string | null;
  selfReportedMetadata?: UnlinkedUserMetadata | null;
}

export interface EmployeeSearchResponse extends ApiListResponse<EmployeeSummary> {
  unlinkedUsers: UnlinkedUserSummary[];
}

export interface ManualEmployeePayload {
  userId?: string;
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
  departmentId?: string;
  reportingOfficerId: string;
  countersigningOfficerId?: string;
  // optional metadata
  gender?: Gender;
  dateOfBirth?: string;
  basicPay?: number;
  appointmentToBpsDate?: string;
  educationLevel?: EducationLevel;
  qualifications?: string;
  fatherName?: string;
  deputationType?: DeputationType;
  natureOfDuties?: string;
  personnelNumber?: string;
  serviceGroup?: string;
  licenseType?: string;
  vehicleType?: string;
  trainingCoursesText?: string;
  trainingCourses?: Array<{ courseName: string; durationFrom?: string; durationTo?: string; institution?: string; country?: string }>;
  disciplinaryRecords?: Array<{ type: DisciplinaryRecordType; description: string; year?: number; outcome?: string; awardedDate?: string }>;
  rewards?: Array<{ type: RewardType; description: string; awardedDate?: string; awardedBy?: string }>;
  languages?: Array<{ language: string; speaking: LanguageProficiencyLevel; reading: LanguageProficiencyLevel; writing: LanguageProficiencyLevel }>;
}

export interface UpdateEmployeeMetadataPayload {
  userId?: string | null;
  gender?: Gender;
  dateOfBirth?: string;
  basicPay?: number;
  appointmentToBpsDate?: string;
  educationLevel?: EducationLevel;
  qualifications?: string;
  fatherName?: string;
  deputationType?: DeputationType;
  natureOfDuties?: string;
  personnelNumber?: string;
  serviceGroup?: string;
  licenseType?: string;
  vehicleType?: string;
  trainingCoursesText?: string;
  trainingCourses?: Array<{ courseName: string; durationFrom?: string; durationTo?: string; institution?: string; country?: string }>;
  disciplinaryRecords?: Array<{ type: DisciplinaryRecordType; description: string; year?: number; outcome?: string; awardedDate?: string }>;
  rewards?: Array<{ type: RewardType; description: string; awardedDate?: string; awardedBy?: string }>;
  languages?: Array<{ language: string; speaking: LanguageProficiencyLevel; reading: LanguageProficiencyLevel; writing: LanguageProficiencyLevel }>;
}

export interface ManualAssignmentOfficeOption {
  id: string;
  name: string;
  code: string;
  scopeTrack: OrgScopeTrack;
  wingName?: string | null;
  directorateName?: string | null;
  regionName?: string | null;
  zoneName?: string | null;
  circleName?: string | null;
  stationName?: string | null;
  branchName?: string | null;
  cellName?: string | null;
  departments: Array<{ id: string; name: string; code: string }>;
}

export interface ManualAssignmentOfficerOption {
  id: string;
  displayName: string;
  badgeNo: string;
  officeName?: string | null;
  zoneName?: string | null;
  wingName?: string | null;
  directorateName?: string | null;
  regionName?: string | null;
  circleName?: string | null;
  stationName?: string | null;
  branchName?: string | null;
  cellName?: string | null;
  departmentName?: string | null;
  scopeLabel: string;
}

export interface ManualEmployeeOptions {
  offices: ManualAssignmentOfficeOption[];
  reportingOfficers: ManualAssignmentOfficerOption[];
  countersigningOfficers: ManualAssignmentOfficerOption[];
}

export interface ArchiveRecordSummary {
  id: string;
  source: ArchiveRecordSource;
  scopeTrack?: OrgScopeTrack | null;
  employeeId: string;
  acrRecordId?: string | null;
  acrNo?: string | null;
  employeeName: string;
  employeeServiceNumber?: string | null;
  employeeCnic?: string | null;
  employeePosting?: string | null;
  templateFamily?: TemplateFamilyCode | null;
  reportingPeriodFrom?: string | null;
  reportingPeriodTo?: string | null;
  reportingPeriod?: string | null;
  hasHistoricalPdf?: boolean;
  archiveReference?: string | null;
  documentFileId?: string | null;
  documentFileName?: string | null;
  documentUrl?: string | null;
  positionTitle?: string | null;
  isVerified: boolean;
  createdAt: string;
  verifiedAt?: string | null;
  uploadedBy?: string | null;
  verifiedBy?: string | null;
  remarks?: string;
  organization?: UserScope | null;
  orgLabel?: string | null;
  employee?: EmployeeSummary | null;
}

export interface EmployeePortalProfile extends EmployeeSummary {
  editableFields: {
    mobile: string;
    email: string;
    posting: string;
    address: string;
  };
  readOnlyFields: {
    rank: string;
    designation?: string | null;
    positionTitle?: string | null;
    bps: number;
    reportingOfficer?: string | null;
    countersigningOfficer?: string | null;
  };
}

export interface EmployeePortalProfileInput {
  mobile?: string;
  email?: string;
  posting?: string;
  address?: string;
}

export interface OrganizationSummaryEntry {
  id: string;
  name: string;
  code: string;
  track: OrgScopeTrack | "ROOT";
  zones: Array<{
    id: string;
    name: string;
    code: string;
    offices: Array<{ id: string; name: string; code: string; employeeCount: number; userCount: number }>;
  }>;
}

export interface OrganizationMasterData {
  wings: Array<{ id: string; name: string; code: string }>;
  directorates: Array<{ id: string; name: string; code: string; wingId: string }>;
  regions: Array<{ id: string; name: string; code: string; wingId?: string | null; directorateId?: string | null }>;
  zones: Array<{ id: string; name: string; code: string; wingId?: string | null; regionId?: string | null }>;
  circles: Array<{ id: string; name: string; code: string; wingId?: string | null; regionId?: string | null; zoneId: string }>;
  stations: Array<{ id: string; name: string; code: string; wingId?: string | null; regionId?: string | null; zoneId: string; circleId?: string | null }>;
  branches: Array<{ id: string; name: string; code: string; wingId?: string | null; regionId?: string | null; zoneId: string; circleId?: string | null; stationId?: string | null }>;
  cells: Array<{ id: string; name: string; code: string; wingId?: string | null; regionId?: string | null; zoneId: string; circleId?: string | null; stationId?: string | null; branchId?: string | null }>;
  offices: Array<{
    id: string;
    name: string;
    code: string;
    scopeTrack: OrgScopeTrack;
    wingId?: string | null;
    directorateId?: string | null;
    regionId?: string | null;
    zoneId?: string | null;
    circleId?: string | null;
    stationId?: string | null;
    branchId?: string | null;
    cellId?: string | null;
  }>;
  departments: Array<{ id: string; name: string; code: string; officeId: string }>;
}
