import { canAccessEmployee, canCreateAcr, canCreateEmployeeRecord, canEditAcrForm, canManageUsers, canTransitionAcr } from "./security.utils";

describe("security utils", () => {
  const baseAcr = {
    id: "acr-1",
    employeeId: "employee-1",
    initiatedById: "user-clerk",
    currentHolderId: "user-clerk",
    reportingOfficerId: "user-ro",
    countersigningOfficerId: "user-cso",
  } as unknown as Parameters<typeof canTransitionAcr>[1];

  function makeUser(id: string, roles: string[], extras?: Record<string, unknown>) {
    return {
      id,
      activeRole: roles[0],
      activeAssignment: { role: roles[0] },
      roleAssignments: roles.map((role) => ({ role })),
      employeeProfiles: [],
      secretBranchProfile: null,
      ...extras,
    } as unknown as Parameters<typeof canCreateAcr>[0];
  }

  it("allows clerks to create ACRs and manual employee records", () => {
    const clerk = makeUser("user-clerk", ["CLERK"]);

    expect(canCreateAcr(clerk)).toBe(true);
    expect(canCreateEmployeeRecord(clerk)).toBe(true);
    expect(canTransitionAcr(clerk, baseAcr, "submit_to_reporting")).toBe(true);
  });

  it("allows the assigned reporting officer to move records onward", () => {
    const reportingOfficer = makeUser("user-ro", ["REPORTING_OFFICER"]);
    const assignedAcr = {
      ...baseAcr,
      currentHolderId: "user-ro",
      workflowState: "PENDING_REPORTING",
      countersigningOfficerId: "user-cso",
    } as unknown as Parameters<typeof canTransitionAcr>[1];

    expect(canTransitionAcr(reportingOfficer, assignedAcr, "forward_to_countersigning")).toBe(true);
    expect(canEditAcrForm(reportingOfficer, assignedAcr)).toBe(true);
  });

  it("allows the assigned countersigning officer to submit to secret branch or return to reporting", () => {
    const countersigningOfficer = makeUser("user-cso", ["COUNTERSIGNING_OFFICER"]);
    const assignedAcr = {
      ...baseAcr,
      currentHolderId: "user-cso",
      workflowState: "PENDING_COUNTERSIGNING",
    } as unknown as Parameters<typeof canTransitionAcr>[1];

    expect(canTransitionAcr(countersigningOfficer, assignedAcr, "submit_to_secret_branch")).toBe(true);
    expect(canTransitionAcr(countersigningOfficer, assignedAcr, "return_to_reporting")).toBe(true);
    expect(canEditAcrForm(countersigningOfficer, assignedAcr)).toBe(true);
  });

  it("allows Secret Branch review and verification based on desk capabilities", () => {
    const reviewer = makeUser("user-da1", ["SECRET_BRANCH"], {
      secretBranchProfile: { canManageUsers: false, canVerify: false, isActive: true },
    });
    const verifier = makeUser("user-ad", ["SECRET_BRANCH"], {
      secretBranchProfile: { canManageUsers: true, canVerify: true, isActive: true },
    });
    const reviewAcr = {
      ...baseAcr,
      currentHolderId: "user-da1",
      workflowState: "PENDING_SECRET_BRANCH_REVIEW",
    } as unknown as Parameters<typeof canTransitionAcr>[1];
    const verifyAcr = {
      ...baseAcr,
      currentHolderId: "user-ad",
      workflowState: "PENDING_SECRET_BRANCH_VERIFICATION",
    } as unknown as Parameters<typeof canTransitionAcr>[1];

    expect(canTransitionAcr(reviewer, reviewAcr, "complete_secret_branch_review")).toBe(true);
    expect(canTransitionAcr(verifier, verifyAcr, "verify_secret_branch")).toBe(true);
    expect(canManageUsers(reviewer)).toBe(false);
    expect(canManageUsers(verifier)).toBe(true);
  });

  it("blocks inactive Secret Branch profiles and IT Ops from delegated user administration", () => {
    const inactiveSecretBranch = makeUser("user-da2", ["SECRET_BRANCH"], {
      secretBranchProfile: { canManageUsers: true, canVerify: true, isActive: false },
    });
    const itOps = makeUser("user-it", ["IT_OPS"]);
    const verifyAcr = {
      ...baseAcr,
      currentHolderId: "user-da2",
      workflowState: "PENDING_SECRET_BRANCH_VERIFICATION",
    } as unknown as Parameters<typeof canTransitionAcr>[1];

    expect(canManageUsers(inactiveSecretBranch)).toBe(false);
    expect(canTransitionAcr(inactiveSecretBranch, verifyAcr, "verify_secret_branch")).toBe(false);
    expect(canManageUsers(itOps)).toBe(false);
  });

  it("blocks stale workflow actions once ownership has moved onward", () => {
    const reportingOfficer = makeUser("user-ro", ["REPORTING_OFFICER"]);
    const countersigningOfficer = makeUser("user-cso", ["COUNTERSIGNING_OFFICER"]);
    const movedAcr = {
      ...baseAcr,
      currentHolderId: "user-cso",
      workflowState: "PENDING_COUNTERSIGNING",
    } as unknown as Parameters<typeof canTransitionAcr>[1];

    expect(canTransitionAcr(reportingOfficer, movedAcr, "forward_to_countersigning")).toBe(false);
    expect(canEditAcrForm(reportingOfficer, movedAcr)).toBe(false);
    expect(canTransitionAcr(countersigningOfficer, { ...movedAcr, currentHolderId: "user-ro" } as typeof movedAcr, "submit_to_secret_branch")).toBe(false);
  });

  it("blocks oversight-only users from mutating workflow records", () => {
    const oversight = makeUser("user-wing", ["WING_OVERSIGHT"]);

    expect(canCreateAcr(oversight)).toBe(false);
    expect(canCreateEmployeeRecord(oversight)).toBe(false);
    expect(canTransitionAcr(oversight, baseAcr, "submit_to_reporting")).toBe(false);
  });

  it("enforces deepest regional scope matching for visibility", () => {
    const zonalOversight = makeUser("user-zone", ["ZONAL_OVERSIGHT"], {
      scopeTrack: "REGIONAL",
      activeAssignment: {
        role: "ZONAL_OVERSIGHT",
        scopeTrack: "REGIONAL",
        wingId: null,
        directorateId: null,
        regionId: "region-north",
        zoneId: "zone-lhr",
        circleId: null,
        stationId: null,
        branchId: null,
        cellId: null,
        officeId: null,
        departmentId: null,
      },
    });

    expect(canAccessEmployee(zonalOversight, {
      id: "employee-a",
      scopeTrack: "REGIONAL",
      regionId: "region-north",
      zoneId: "zone-lhr",
      officeId: "office-a",
    })).toBe(true);

    expect(canAccessEmployee(zonalOversight, {
      id: "employee-b",
      scopeTrack: "REGIONAL",
      regionId: "region-north",
      zoneId: "zone-isb",
      officeId: "office-b",
    })).toBe(false);
  });

  it("enforces wing-track office scope for clerks", () => {
    const clerk = makeUser("user-clerk-wing", ["CLERK"], {
      scopeTrack: "WING",
      activeAssignment: {
        role: "CLERK",
        scopeTrack: "WING",
        wingId: "wing-immigration",
        directorateId: "dir-ops",
        regionId: null,
        zoneId: null,
        circleId: null,
        stationId: null,
        branchId: null,
        cellId: null,
        officeId: "office-hq",
        departmentId: null,
      },
    });

    expect(canAccessEmployee(clerk, {
      id: "employee-c",
      scopeTrack: "WING",
      wingId: "wing-immigration",
      directorateId: "dir-ops",
      officeId: "office-hq",
    })).toBe(true);

    expect(canAccessEmployee(clerk, {
      id: "employee-d",
      scopeTrack: "WING",
      wingId: "wing-immigration",
      directorateId: "dir-ops",
      officeId: "office-other",
    })).toBe(false);
  });
});
