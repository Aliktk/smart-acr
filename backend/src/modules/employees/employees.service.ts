import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { type EmployeeStatus, TemplateFamilyCode, UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { templateFamilyRequiresCountersigning } from "../../common/template-catalog";
import { PrismaService } from "../../common/prisma.service";
import { buildScopedOrgWhere, canCreateEmployeeRecord, loadScopedUser } from "../../helpers/security.utils";
import { matchesOrgScope, scopeSpecificity } from "../../helpers/org-scope.utils";
import { mapEmployee } from "../../helpers/view-mappers";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeMetadataDto } from "./dto/update-employee-metadata.dto";
import { UpdateEmployeePortalProfileDto } from "./dto/update-employee-portal-profile.dto";

type ScopedUser = Awaited<ReturnType<typeof loadScopedUser>>;
type OfficeWithOrg = Prisma.OfficeGetPayload<{
  include: {
    wing: { select: { name: true } };
    directorate: { select: { name: true } };
    region: { select: { name: true } };
    zone: { select: { name: true } };
    circle: { select: { name: true } };
    station: { select: { name: true } };
    branch: { select: { name: true } };
    cell: { select: { name: true } };
    departments: { select: { id: true; name: true; code: true } };
  };
}>;
type RoleAssignmentWithUser = Prisma.UserRoleAssignmentGetPayload<{
  include: {
    user: {
      include: {
        office: { select: { name: true } };
        zone: { select: { name: true } };
        wing: { select: { name: true } };
        directorate: { select: { name: true } };
        region: { select: { name: true } };
        circle: { select: { name: true } };
        station: { select: { name: true } };
        branch: { select: { name: true } };
        cell: { select: { name: true } };
        department: { select: { name: true } };
      };
    };
    office: { select: { name: true } };
    zone: { select: { name: true } };
    wing: { select: { name: true } };
    directorate: { select: { name: true } };
    region: { select: { name: true } };
    circle: { select: { name: true } };
    station: { select: { name: true } };
    branch: { select: { name: true } };
    cell: { select: { name: true } };
    department: { select: { name: true } };
  };
}>;

type ManualCreationScope = {
  offices: OfficeWithOrg[];
};

const EMPLOYEE_ORG_INCLUDE = {
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
  reportingOfficer: {
    include: {
      employeeProfiles: {
        select: {
          designation: true,
        },
      },
    },
  },
  countersigningOfficer: {
    include: {
      employeeProfiles: {
        select: {
          designation: true,
        },
      },
    },
  },
  trainingCourses: true,
  disciplinaryRecords: true,
  rewards: true,
  languages: true,
} satisfies Prisma.EmployeeInclude;

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async getPortalProfile(userId: string, activeRole: UserRole) {
    const employee = await this.requirePortalEmployee(userId, activeRole);
    return this.buildPortalProfileResponse(employee);
  }

  async updatePortalProfile(userId: string, activeRole: UserRole, dto: UpdateEmployeePortalProfileDto, ipAddress?: string) {
    const employee = await this.requirePortalEmployee(userId, activeRole);
    const normalized = this.normalizePortalProfileUpdate(dto);

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextEmployee = await tx.employee.update({
        where: { id: employee.id },
        data: normalized.employeeData,
        include: EMPLOYEE_ORG_INCLUDE,
      });

      if (employee.userId && Object.keys(normalized.userData).length > 0) {
        await tx.user.update({
          where: { id: employee.userId },
          data: normalized.userData,
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          actorRole: "Employee",
          action: "Employee profile updated",
          recordType: "EMPLOYEE",
          recordId: employee.id,
          ipAddress: ipAddress ?? "unknown",
          details: `Employee metadata updated for ${employee.name}.`,
          metadata: {
            changedFields: normalized.changedFields,
            employeeUserId: employee.userId ?? null,
          } as Prisma.InputJsonValue,
        },
      });

      return nextEmployee;
    });

    return this.buildPortalProfileResponse(updated);
  }

  async updateStatus(
    userId: string,
    activeRole: UserRole,
    employeeId: string,
    status: EmployeeStatus,
    retirementDate?: string | null,
    ipAddress = "0.0.0.0",
  ) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);

    if (user.activeRole !== UserRole.SUPER_ADMIN && user.activeRole !== UserRole.IT_OPS) {
      throw new ForbiddenException("Only system administrators can change employee status.");
    }

    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    const data: Record<string, unknown> = { status };

    if (status === "SUSPENDED") {
      data.suspendedFrom = new Date();
      data.suspendedTo = null;
    } else if (employee.status === "SUSPENDED" && status === "ACTIVE") {
      data.suspendedTo = new Date();
    }

    if (status === "RETIRED" && retirementDate) {
      data.retirementDate = new Date(retirementDate);
    } else if (status === "RETIRED" && !employee.retirementDate) {
      data.retirementDate = new Date();
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const nextEmployee = await tx.employee.update({
        where: { id: employeeId },
        data: data as Prisma.EmployeeUpdateInput,
        include: EMPLOYEE_ORG_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorRole: activeRole,
          action: "Employee status changed",
          recordType: "EMPLOYEE",
          recordId: employeeId,
          ipAddress,
          details: `Status changed from ${employee.status} to ${status} for ${employee.name}.`,
        },
      });

      return nextEmployee;
    });

    return mapEmployee(updated);
  }

  async search(userId: string, activeRole: UserRole, query?: string) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    const trimmedQuery = query?.trim();
    const where: Prisma.EmployeeWhereInput = {
      AND: [
        this.buildEmployeeScopeWhere(user),
        trimmedQuery
          ? {
              OR: [
                { name: { contains: trimmedQuery, mode: "insensitive" } },
                { cnic: { contains: trimmedQuery } },
                { mobile: { contains: trimmedQuery } },
                { rank: { contains: trimmedQuery, mode: "insensitive" } },
                { designation: { contains: trimmedQuery, mode: "insensitive" } },
                { posting: { contains: trimmedQuery, mode: "insensitive" } },
                { email: { contains: trimmedQuery, mode: "insensitive" } },
                { serviceNumber: { contains: trimmedQuery, mode: "insensitive" } },
                { office: { name: { contains: trimmedQuery, mode: "insensitive" } } },
                { wing: { name: { contains: trimmedQuery, mode: "insensitive" } } },
                { directorate: { name: { contains: trimmedQuery, mode: "insensitive" } } },
                { region: { name: { contains: trimmedQuery, mode: "insensitive" } } },
                { zone: { name: { contains: trimmedQuery, mode: "insensitive" } } },
                { circle: { name: { contains: trimmedQuery, mode: "insensitive" } } },
                { station: { name: { contains: trimmedQuery, mode: "insensitive" } } },
                { branch: { name: { contains: trimmedQuery, mode: "insensitive" } } },
                { cell: { name: { contains: trimmedQuery, mode: "insensitive" } } },
                { department: { name: { contains: trimmedQuery, mode: "insensitive" } } },
                { reportingOfficer: { displayName: { contains: trimmedQuery, mode: "insensitive" } } },
                { countersigningOfficer: { displayName: { contains: trimmedQuery, mode: "insensitive" } } },
              ],
            }
          : {},
      ],
    };

    const employees = await this.prisma.employee.findMany({
      where,
      include: EMPLOYEE_ORG_INCLUDE,
      orderBy: { name: "asc" },
      take: 50,
    });

    // Also surface Users with EMPLOYEE role who have no linked employee record,
    // so a clerk can find someone by their login account before an employee record exists.
    let unlinkedUsers: Array<{
      id: string;
      displayName: string;
      email: string;
      badgeNo: string;
      mobileNumber: string | null;
      cnic: string | null;
      departmentId: string | null;
      selfReportedMetadata: unknown;
    }> = [];

    if (trimmedQuery) {
      unlinkedUsers = await this.prisma.user.findMany({
        where: {
          employeeProfiles: { none: {} },
          roleAssignments: { some: { role: UserRole.EMPLOYEE } },
          isActive: true,
          OR: [
            { displayName: { contains: trimmedQuery, mode: "insensitive" } },
            { email: { contains: trimmedQuery, mode: "insensitive" } },
            { badgeNo: { contains: trimmedQuery, mode: "insensitive" } },
            { cnic: { contains: trimmedQuery, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          displayName: true,
          email: true,
          badgeNo: true,
          mobileNumber: true,
          cnic: true,
          departmentId: true,
          selfReportedMetadata: true,
        },
        take: 10,
      });
    }

    return {
      items: employees.map((employee) => mapEmployee(employee)),
      total: employees.length,
      unlinkedUsers,
    };
  }

  private buildEmployeeScopeWhere(user: ScopedUser): Prisma.EmployeeWhereInput {
    if (
      user.activeRole === UserRole.SUPER_ADMIN ||
      user.activeRole === UserRole.IT_OPS ||
      user.activeRole === UserRole.SECRET_BRANCH ||
      user.activeRole === UserRole.DG ||
      user.activeRole === UserRole.EXECUTIVE_VIEWER
    ) {
      return {};
    }

    if (
      user.activeRole === UserRole.WING_OVERSIGHT ||
      user.activeRole === UserRole.ZONAL_OVERSIGHT ||
      user.activeRole === UserRole.CLERK
    ) {
      return buildScopedOrgWhere(user) ?? { id: "__no_access__" };
    }

    if (user.activeRole === UserRole.REPORTING_OFFICER) {
      return { reportingOfficerId: user.id };
    }

    if (user.activeRole === UserRole.COUNTERSIGNING_OFFICER) {
      return { countersigningOfficerId: user.id };
    }

    if (user.activeRole === UserRole.EMPLOYEE) {
      const employeeIds = user.employeeProfiles.map((profile) => profile.id);
      return employeeIds.length > 0 ? { id: { in: employeeIds } } : { id: "__no_access__" };
    }

    return {};
  }

  private async requirePortalEmployee(userId: string, activeRole: UserRole) {
    if (activeRole !== UserRole.EMPLOYEE) {
      throw new ForbiddenException("This endpoint is only available to employee portal users.");
    }

    const user = await loadScopedUser(this.prisma, userId, activeRole);
    const employeeId = user.employeeProfiles[0]?.id;

    if (!employeeId) {
      throw new NotFoundException("The current employee profile could not be resolved.");
    }

    return this.prisma.employee.findUniqueOrThrow({
      where: { id: employeeId },
      include: EMPLOYEE_ORG_INCLUDE,
    });
  }

  private buildPortalProfileResponse(employee: Prisma.EmployeeGetPayload<{ include: typeof EMPLOYEE_ORG_INCLUDE }>) {
    return {
      ...mapEmployee(employee),
      editableFields: {
        mobile: employee.mobile,
        email: employee.email,
        posting: employee.posting,
        address: employee.address,
      },
      readOnlyFields: {
        rank: employee.rank,
        designation: employee.designation,
        positionTitle: employee.positionTitle ?? null,
        bps: employee.bps,
        reportingOfficer: employee.reportingOfficer?.displayName ?? null,
        countersigningOfficer: employee.countersigningOfficer?.displayName ?? null,
      },
    };
  }

  private normalizePortalProfileUpdate(dto: UpdateEmployeePortalProfileDto) {
    const employeeData: Prisma.EmployeeUpdateInput = {};
    const userData: Prisma.UserUpdateInput = {};
    const changedFields: string[] = [];

    if (dto.mobile !== undefined) {
      const mobile = dto.mobile.trim();
      if (!mobile) {
        throw new BadRequestException("Mobile number cannot be empty.");
      }
      employeeData.mobile = mobile;
      userData.mobileNumber = mobile;
      changedFields.push("mobile");
    }

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (!email) {
        throw new BadRequestException("Email address cannot be empty.");
      }
      employeeData.email = email;
      userData.email = email;
      changedFields.push("email");
    }

    if (dto.posting !== undefined) {
      const posting = dto.posting.trim();
      if (!posting) {
        throw new BadRequestException("Current posting cannot be empty.");
      }
      employeeData.posting = posting;
      changedFields.push("posting");
    }

    if (dto.address !== undefined) {
      const address = dto.address.trim();
      if (!address) {
        throw new BadRequestException("Address cannot be empty.");
      }
      employeeData.address = address;
      changedFields.push("address");
    }

    if (changedFields.length === 0) {
      throw new BadRequestException("Provide at least one employee profile field to update.");
    }

    return {
      employeeData,
      userData,
      changedFields,
    };
  }

  async manualOptions(userId: string, activeRole: UserRole, officeId?: string) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);

    if (!canCreateEmployeeRecord(user)) {
      throw new ForbiddenException("Only clerks or system administrators can add new employee records.");
    }

    const scope = await this.resolveManualCreationScope(user);
    const selectedOffice = officeId ? this.requireAccessibleOffice(scope, officeId) : null;

    return {
      offices: scope.offices.map((office) => ({
        id: office.id,
        name: office.name,
        code: office.code,
        scopeTrack: office.scopeTrack,
        wingName: office.wing?.name ?? null,
        directorateName: office.directorate?.name ?? null,
        regionName: office.region?.name ?? null,
        zoneName: office.zone?.name ?? null,
        circleName: office.circle?.name ?? null,
        stationName: office.station?.name ?? null,
        branchName: office.branch?.name ?? null,
        cellName: office.cell?.name ?? null,
        departments: office.departments,
      })),
      reportingOfficers: await this.listAssignableOfficers(UserRole.REPORTING_OFFICER, scope, selectedOffice),
      countersigningOfficers: await this.listAssignableOfficers(UserRole.COUNTERSIGNING_OFFICER, scope, selectedOffice),
    };
  }

  async create(userId: string, activeRole: UserRole, dto: CreateEmployeeDto) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);

    if (!canCreateEmployeeRecord(user)) {
      throw new ForbiddenException("Only clerks or system administrators can add new employee records.");
    }

    const scope = await this.resolveManualCreationScope(user);
    const office = this.requireAccessibleOffice(scope, dto.officeId);
    const department = await this.resolveDepartmentForOffice(office, dto.departmentId);
    const reportingOfficer = await this.requireAssignableOfficer(dto.reportingOfficerId, UserRole.REPORTING_OFFICER, office);
    const countersigningOfficer = this.requiresCountersigning(dto.templateFamily)
      ? await this.requireCountersigningOfficer(dto, office)
      : null;
    const normalizedCnic = this.normalizeCnic(dto.cnic);
    const normalizedEmail = dto.email?.trim().toLowerCase() ?? this.defaultEmailFor(dto.name);

    const existingEmployee = await this.prisma.employee.findUnique({
      where: { cnic: normalizedCnic },
      select: {
        id: true,
        name: true,
        serviceNumber: true,
      },
    });

    if (dto.userId) {
      const linkedUser = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true } });
      if (!linkedUser) {
        throw new BadRequestException("The specified user account does not exist.");
      }
    }

    if (existingEmployee) {
      throw new ConflictException(
        `An employee record already exists for CNIC ${normalizedCnic} under ${existingEmployee.name} (${existingEmployee.serviceNumber}).`,
      );
    }

    // Auto-link to an existing user account when email matches and no userId was explicitly provided
    let resolvedUserId = dto.userId ?? null;
    if (!resolvedUserId && normalizedEmail) {
      const matchedUser = await this.prisma.user.findFirst({
        where: { email: normalizedEmail },
        select: { id: true },
      });
      if (matchedUser) {
        resolvedUserId = matchedUser.id;
      }
    }

    try {
      const serviceNumber = await this.nextServiceNumber();
      const employee = await this.prisma.employee.create({
        data: {
          userId: resolvedUserId,
          serviceNumber,
          name: dto.name.trim(),
          rank: dto.rank.trim(),
          designation: dto.designation.trim(),
          bps: dto.bps,
          cnic: normalizedCnic,
          mobile: dto.mobile.trim(),
          email: normalizedEmail,
          posting: dto.posting.trim(),
          joiningDate: new Date(dto.joiningDate),
          serviceYears: this.calculateServiceYears(dto.joiningDate),
          address: dto.address.trim(),
          templateFamily: dto.templateFamily,
          scopeTrack: office.scopeTrack,
          wingId: office.wingId,
          directorateId: office.directorateId,
          regionId: office.regionId,
          zoneId: office.zoneId,
          circleId: office.circleId,
          stationId: office.stationId,
          branchId: office.branchId,
          cellId: office.cellId,
          officeId: office.id,
          departmentId: department?.id ?? null,
          reportingOfficerId: reportingOfficer.id,
          countersigningOfficerId: countersigningOfficer?.id ?? null,
          // metadata scalar fields
          gender: dto.gender ?? null,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          basicPay: dto.basicPay ?? null,
          appointmentToBpsDate: dto.appointmentToBpsDate ? new Date(dto.appointmentToBpsDate) : null,
          educationLevel: dto.educationLevel ?? null,
          qualifications: dto.qualifications ?? null,
          fatherName: dto.fatherName ?? null,
          deputationType: dto.deputationType ?? null,
          natureOfDuties: dto.natureOfDuties ?? null,
          personnelNumber: dto.personnelNumber ?? null,
          serviceGroup: dto.serviceGroup ?? null,
          licenseType: dto.licenseType ?? null,
          vehicleType: dto.vehicleType ?? null,
          trainingCoursesText: dto.trainingCoursesText ?? null,
          // nested relation tables
          ...(dto.trainingCourses?.length
            ? {
                trainingCourses: {
                  create: dto.trainingCourses.map((course) => ({
                    courseName: course.courseName,
                    durationFrom: course.durationFrom ? new Date(course.durationFrom) : null,
                    durationTo: course.durationTo ? new Date(course.durationTo) : null,
                    institution: course.institution ?? null,
                    country: course.country ?? null,
                  })),
                },
              }
            : {}),
          ...(dto.disciplinaryRecords?.length
            ? {
                disciplinaryRecords: {
                  create: dto.disciplinaryRecords.map((record) => ({
                    type: record.type,
                    description: record.description,
                    year: record.year ?? null,
                    outcome: record.outcome ?? null,
                    awardedDate: record.awardedDate ? new Date(record.awardedDate) : null,
                  })),
                },
              }
            : {}),
          ...(dto.rewards?.length
            ? {
                rewards: {
                  create: dto.rewards.map((reward) => ({
                    type: reward.type,
                    description: reward.description,
                    awardedDate: reward.awardedDate ? new Date(reward.awardedDate) : null,
                    awardedBy: reward.awardedBy ?? null,
                  })),
                },
              }
            : {}),
          ...(dto.languages?.length
            ? {
                languages: {
                  create: dto.languages.map((lang) => ({
                    language: lang.language,
                    speaking: lang.speaking,
                    reading: lang.reading,
                    writing: lang.writing,
                  })),
                },
              }
            : {}),
        },
        include: EMPLOYEE_ORG_INCLUDE,
      });

      return mapEmployee(employee);
    } catch (error) {
      this.rethrowUniqueConstraint(error, normalizedCnic);
      throw error;
    }
  }

  async updateMetadata(userId: string, activeRole: UserRole, employeeId: string, dto: UpdateEmployeeMetadataDto) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);

    if (!canCreateEmployeeRecord(user)) {
      throw new ForbiddenException("Only clerks or system administrators can update employee metadata.");
    }

    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    if (dto.userId) {
      const linkedUser = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true } });
      if (!linkedUser) {
        throw new BadRequestException("The specified user account does not exist.");
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          ...(dto.userId !== undefined && { userId: dto.userId ?? null }),
          gender: dto.gender !== undefined ? dto.gender : undefined,
          dateOfBirth: dto.dateOfBirth !== undefined ? (dto.dateOfBirth ? new Date(dto.dateOfBirth) : null) : undefined,
          basicPay: dto.basicPay !== undefined ? dto.basicPay : undefined,
          appointmentToBpsDate: dto.appointmentToBpsDate !== undefined ? (dto.appointmentToBpsDate ? new Date(dto.appointmentToBpsDate) : null) : undefined,
          educationLevel: dto.educationLevel !== undefined ? dto.educationLevel : undefined,
          qualifications: dto.qualifications !== undefined ? dto.qualifications : undefined,
          fatherName: dto.fatherName !== undefined ? dto.fatherName : undefined,
          spouseName: dto.spouseName !== undefined ? dto.spouseName : undefined,
          deputationType: dto.deputationType !== undefined ? dto.deputationType : undefined,
          natureOfDuties: dto.natureOfDuties !== undefined ? dto.natureOfDuties : undefined,
          personnelNumber: dto.personnelNumber !== undefined ? dto.personnelNumber : undefined,
          serviceGroup: dto.serviceGroup !== undefined ? dto.serviceGroup : undefined,
          licenseType: dto.licenseType !== undefined ? dto.licenseType : undefined,
          vehicleType: dto.vehicleType !== undefined ? dto.vehicleType : undefined,
          trainingCoursesText: dto.trainingCoursesText !== undefined ? dto.trainingCoursesText : undefined,
        },
      });

      if (dto.trainingCourses !== undefined) {
        await tx.employeeTrainingCourse.deleteMany({ where: { employeeId } });
        if (dto.trainingCourses.length > 0) {
          await tx.employeeTrainingCourse.createMany({
            data: dto.trainingCourses.map((course) => ({
              employeeId,
              courseName: course.courseName,
              durationFrom: course.durationFrom ? new Date(course.durationFrom) : null,
              durationTo: course.durationTo ? new Date(course.durationTo) : null,
              institution: course.institution ?? null,
              country: course.country ?? null,
            })),
          });
        }
      }

      if (dto.disciplinaryRecords !== undefined) {
        await tx.employeeDisciplinaryRecord.deleteMany({ where: { employeeId } });
        if (dto.disciplinaryRecords.length > 0) {
          await tx.employeeDisciplinaryRecord.createMany({
            data: dto.disciplinaryRecords.map((record) => ({
              employeeId,
              type: record.type,
              description: record.description,
              year: record.year ?? null,
              outcome: record.outcome ?? null,
              awardedDate: record.awardedDate ? new Date(record.awardedDate) : null,
            })),
          });
        }
      }

      if (dto.rewards !== undefined) {
        await tx.employeeReward.deleteMany({ where: { employeeId } });
        if (dto.rewards.length > 0) {
          await tx.employeeReward.createMany({
            data: dto.rewards.map((reward) => ({
              employeeId,
              type: reward.type,
              description: reward.description,
              awardedDate: reward.awardedDate ? new Date(reward.awardedDate) : null,
              awardedBy: reward.awardedBy ?? null,
            })),
          });
        }
      }

      if (dto.languages !== undefined) {
        await tx.employeeLanguageProficiency.deleteMany({ where: { employeeId } });
        if (dto.languages.length > 0) {
          await tx.employeeLanguageProficiency.createMany({
            data: dto.languages.map((lang) => ({
              employeeId,
              language: lang.language,
              speaking: lang.speaking,
              reading: lang.reading,
              writing: lang.writing,
            })),
          });
        }
      }

      return tx.employee.findUniqueOrThrow({
        where: { id: employeeId },
        include: EMPLOYEE_ORG_INCLUDE,
      });
    });

    return mapEmployee(updated);
  }

  private async resolveManualCreationScope(user: ScopedUser) {
    const hasAdministrativeRole = user.roleAssignments.some((assignment) =>
      assignment.role === UserRole.SUPER_ADMIN || assignment.role === UserRole.IT_OPS,
    );
    const scopedWhere = hasAdministrativeRole ? undefined : buildScopedOrgWhere(user);
    const scopedOfficeId = hasAdministrativeRole ? null : user.activeAssignment?.officeId ?? user.officeId ?? null;
    const officeWhere = scopedOfficeId
      ? { id: scopedOfficeId }
      : scopedWhere
        ? {
            ...scopedWhere,
            ...(scopedWhere.officeId ? { id: scopedWhere.officeId } : {}),
          }
        : scopedWhere;

    if (officeWhere && "officeId" in officeWhere) {
      delete (officeWhere as { officeId?: string }).officeId;
    }
    if (officeWhere && "departmentId" in officeWhere) {
      delete (officeWhere as { departmentId?: string }).departmentId;
    }

    if (officeWhere === null) {
      throw new BadRequestException("The current user does not have a valid organizational scope for manual employee entry.");
    }

    const offices = await this.prisma.office.findMany({
      where: officeWhere,
      include: {
        wing: { select: { name: true } },
        directorate: { select: { name: true } },
        region: { select: { name: true } },
        zone: { select: { name: true } },
        circle: { select: { name: true } },
        station: { select: { name: true } },
        branch: { select: { name: true } },
        cell: { select: { name: true } },
        departments: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ region: { name: "asc" } }, { wing: { name: "asc" } }, { zone: { name: "asc" } }, { name: "asc" }],
    });

    if (offices.length === 0) {
      throw new BadRequestException("No offices are available for the current assignment scope.");
    }

    return {
      offices,
    } satisfies ManualCreationScope;
  }

  private requireAccessibleOffice(scope: ManualCreationScope, officeId: string) {
    const office = scope.offices.find((entry) => entry.id === officeId);

    if (!office) {
      throw new BadRequestException("The selected office is outside your permitted assignment scope.");
    }

    return office;
  }

  private requiresCountersigning(templateFamily: TemplateFamilyCode) {
    return templateFamilyRequiresCountersigning(templateFamily);
  }

  private async requireCountersigningOfficer(dto: CreateEmployeeDto, office: OfficeWithOrg) {
    if (!dto.countersigningOfficerId) {
      throw new BadRequestException("A countersigning officer is required for the selected form family.");
    }

    return this.requireAssignableOfficer(dto.countersigningOfficerId, UserRole.COUNTERSIGNING_OFFICER, office);
  }

  private async requireAssignableOfficer(userId: string, role: UserRole, office: OfficeWithOrg) {
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: {
        userId,
        role,
        user: {
          isActive: true,
        },
      },
      include: {
        user: {
          include: {
            office: { select: { name: true } },
            zone: { select: { name: true } },
            wing: { select: { name: true } },
            directorate: { select: { name: true } },
            region: { select: { name: true } },
            circle: { select: { name: true } },
            station: { select: { name: true } },
            branch: { select: { name: true } },
            cell: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
        office: { select: { name: true } },
        zone: { select: { name: true } },
        wing: { select: { name: true } },
        directorate: { select: { name: true } },
        region: { select: { name: true } },
        circle: { select: { name: true } },
        station: { select: { name: true } },
        branch: { select: { name: true } },
        cell: { select: { name: true } },
        department: { select: { name: true } },
      },
    });
    const assignment = assignments
      .filter((entry) => matchesOrgScope(entry, office))
      .sort((left, right) => this.assignmentSpecificity(right) - this.assignmentSpecificity(left))[0]
      ?? assignments
        .sort((left, right) => this.assignmentSpecificity(right) - this.assignmentSpecificity(left))[0];

    if (!assignment?.user) {
      throw new BadRequestException(`The selected ${this.roleLabel(role)} is not available for assignment.`);
    }

    return assignment.user;
  }

  private async listAssignableOfficers(role: UserRole, scope: ManualCreationScope, selectedOffice: OfficeWithOrg | null) {
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: {
        role,
        user: {
          isActive: true,
        },
      },
      include: {
        user: {
          include: {
            office: { select: { name: true } },
            zone: { select: { name: true } },
            wing: { select: { name: true } },
            directorate: { select: { name: true } },
            region: { select: { name: true } },
            circle: { select: { name: true } },
            station: { select: { name: true } },
            branch: { select: { name: true } },
            cell: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
        office: { select: { name: true } },
        zone: { select: { name: true } },
        wing: { select: { name: true } },
        directorate: { select: { name: true } },
        region: { select: { name: true } },
        circle: { select: { name: true } },
        station: { select: { name: true } },
        branch: { select: { name: true } },
        cell: { select: { name: true } },
        department: { select: { name: true } },
      },
    });
    const matchingAssignments = assignments.filter((assignment) =>
      selectedOffice
        ? matchesOrgScope(assignment, selectedOffice)
        : scope.offices.some((office) => matchesOrgScope(assignment, office)),
    );
    const scopedAssignments = matchingAssignments.length > 0 ? matchingAssignments : assignments;

    const deduped = new Map<string, RoleAssignmentWithUser>();

    for (const assignment of scopedAssignments) {
      const existing = deduped.get(assignment.userId);

      if (!existing || this.assignmentSpecificity(assignment) > this.assignmentSpecificity(existing)) {
        deduped.set(assignment.userId, assignment);
      }
    }

    return Array.from(deduped.values())
      .sort((left, right) => left.user.displayName.localeCompare(right.user.displayName))
      .map((assignment) => ({
        id: assignment.userId,
        displayName: assignment.user.displayName,
        badgeNo: assignment.user.badgeNo,
        officeName: assignment.user.office?.name ?? assignment.office?.name ?? null,
        zoneName: assignment.user.zone?.name ?? assignment.zone?.name ?? null,
        wingName: assignment.user.wing?.name ?? assignment.wing?.name ?? null,
        directorateName: assignment.user.directorate?.name ?? assignment.directorate?.name ?? null,
        regionName: assignment.user.region?.name ?? assignment.region?.name ?? null,
        circleName: assignment.user.circle?.name ?? assignment.circle?.name ?? null,
        stationName: assignment.user.station?.name ?? assignment.station?.name ?? null,
        branchName: assignment.user.branch?.name ?? assignment.branch?.name ?? null,
        cellName: assignment.user.cell?.name ?? assignment.cell?.name ?? null,
        departmentName: assignment.user.department?.name ?? assignment.department?.name ?? null,
        scopeLabel: this.scopeLabelForAssignment(assignment),
      }));
  }

  private assignmentSpecificity(assignment: RoleAssignmentWithUser) {
    return scopeSpecificity(assignment);
  }

  private scopeLabelForAssignment(assignment: RoleAssignmentWithUser) {
    if (assignment.department?.name) {
      return assignment.department.name;
    }
    if (assignment.office?.name) {
      return assignment.office.name;
    }

    if (assignment.cell?.name) {
      return assignment.cell.name;
    }

    if (assignment.branch?.name) {
      return assignment.branch.name;
    }

    if (assignment.station?.name) {
      return assignment.station.name;
    }

    if (assignment.circle?.name) {
      return assignment.circle.name;
    }

    if (assignment.zone?.name) {
      return assignment.zone.name;
    }

    if (assignment.region?.name) {
      return assignment.region.name;
    }

    if (assignment.directorate?.name) {
      return assignment.directorate.name;
    }

    if (assignment.wing?.name) {
      return assignment.wing.name;
    }

    if (assignment.user.department?.name) {
      return assignment.user.department.name;
    }

    if (assignment.user.office?.name) {
      return assignment.user.office.name;
    }

    if (assignment.user.cell?.name) {
      return assignment.user.cell.name;
    }

    if (assignment.user.branch?.name) {
      return assignment.user.branch.name;
    }

    if (assignment.user.station?.name) {
      return assignment.user.station.name;
    }

    if (assignment.user.circle?.name) {
      return assignment.user.circle.name;
    }

    if (assignment.user.zone?.name) {
      return assignment.user.zone.name;
    }

    if (assignment.user.region?.name) {
      return assignment.user.region.name;
    }

    if (assignment.user.directorate?.name) {
      return assignment.user.directorate.name;
    }

    if (assignment.user.wing?.name) {
      return assignment.user.wing.name;
    }

    return "FIA";
  }

  private roleLabel(role: UserRole) {
    return role === UserRole.REPORTING_OFFICER ? "reporting officer" : "countersigning officer";
  }

  private async resolveDepartmentForOffice(office: OfficeWithOrg, departmentId?: string) {
    if (!departmentId) {
      return null;
    }

    const department = office.departments.find((entry) => entry.id === departmentId);
    if (!department) {
      throw new BadRequestException("The selected department does not belong to the chosen office.");
    }

    return department;
  }

  private calculateServiceYears(joiningDate: string) {
    const joinedAt = new Date(joiningDate);
    const diff = Date.now() - joinedAt.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
  }

  private async nextServiceNumber() {
    const employees = await this.prisma.employee.findMany({
      select: {
        serviceNumber: true,
      },
    });
    const maxSequence = employees.reduce((maxValue, employee) => {
      const match = /^EMP-(\d+)$/.exec(employee.serviceNumber);
      if (!match) {
        return maxValue;
      }

      return Math.max(maxValue, Number(match[1]));
    }, 0);

    return `EMP-${String(maxSequence + 1).padStart(3, "0")}`;
  }

  private normalizeCnic(cnic: string) {
    const digitsOnly = cnic.replace(/\D/g, "");
    if (digitsOnly.length === 13) {
      return `${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5, 12)}-${digitsOnly.slice(12)}`;
    }

    return cnic.trim();
  }

  private rethrowUniqueConstraint(error: unknown, cnic: string): never | void {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new ConflictException(`An employee record already exists for CNIC ${cnic}.`);
    }
  }

  private defaultEmailFor(name: string) {
    return `${name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/(^\.|\.$)/g, "")}@fia.gov.pk`;
  }
}
