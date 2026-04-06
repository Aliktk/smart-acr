import { canCreateAcr, canCreateEmployeeRecord, canEditAcrForm, canTransitionAcr } from "./security.utils";

describe("security utils", () => {
  const baseAcr = {
    id: "acr-1",
    employeeId: "employee-1",
    initiatedById: "user-clerk",
    currentHolderId: "user-clerk",
    reportingOfficerId: "user-ro",
    countersigningOfficerId: "user-cso",
  } as unknown as Parameters<typeof canTransitionAcr>[1];

  function makeUser(id: string, roles: string[]) {
    return {
      id,
      activeRole: roles[0],
      activeAssignment: { role: roles[0] },
      roleAssignments: roles.map((role) => ({ role })),
      employeeProfiles: [],
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
    } as unknown as Parameters<typeof canTransitionAcr>[1];

    expect(canTransitionAcr(reportingOfficer, assignedAcr, "forward_to_countersigning")).toBe(true);
    expect(canTransitionAcr(reportingOfficer, assignedAcr, "submit_to_secret_branch")).toBe(true);
    expect(canEditAcrForm(reportingOfficer, assignedAcr)).toBe(true);
  });

  it("allows the assigned countersigning officer to submit to secret branch", () => {
    const countersigningOfficer = makeUser("user-cso", ["COUNTERSIGNING_OFFICER"]);
    const assignedAcr = {
      ...baseAcr,
      currentHolderId: "user-cso",
      workflowState: "PENDING_COUNTERSIGNING",
    } as unknown as Parameters<typeof canTransitionAcr>[1];

    expect(canTransitionAcr(countersigningOfficer, assignedAcr, "submit_to_secret_branch")).toBe(true);
    expect(canTransitionAcr(countersigningOfficer, assignedAcr, "return_to_clerk")).toBe(true);
    expect(canEditAcrForm(countersigningOfficer, assignedAcr)).toBe(true);
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
});
