import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ArchiveRecordSource, Prisma, TemplateFamilyCode, UserRole } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { canAccessEmployee, displayRole, loadScopedUser } from "../../helpers/security.utils";
import { mapArchiveRecord } from "../../helpers/view-mappers";
import { FilesService } from "../files/files.service";
import { CreateHistoricalArchiveDto } from "./dto/create-historical-archive.dto";
import { ListArchiveRecordsDto } from "./dto/list-archive-records.dto";
import { UpdateHistoricalArchiveDto } from "./dto/update-historical-archive.dto";

const ARCHIVE_RECORD_INCLUDE = {
  employee: {
    include: {
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
    },
  },
  uploadedBy: true,
  verifiedBy: true,
  files: true,
  acrRecord: { select: { acrNo: true } },
} satisfies Prisma.ArchiveRecordInclude;

type ArchiveRecordPayload = Prisma.ArchiveRecordGetPayload<{
  include: typeof ARCHIVE_RECORD_INCLUDE;
}>;

@Injectable()
export class ArchiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {}

  private isArchiveReader(activeRole: UserRole): boolean {
    const allowed: UserRole[] = [
      UserRole.SUPER_ADMIN,
      UserRole.IT_OPS,
      UserRole.SECRET_BRANCH,
      UserRole.DG,
      UserRole.EXECUTIVE_VIEWER,
      UserRole.WING_OVERSIGHT,
      UserRole.ZONAL_OVERSIGHT,
    ];
    return allowed.includes(activeRole);
  }

  private isArchiveAdmin(activeRole: UserRole) {
    return activeRole === UserRole.SUPER_ADMIN || activeRole === UserRole.IT_OPS || activeRole === UserRole.SECRET_BRANCH;
  }

  private async requireArchiveAdmin(userId: string, activeRole: UserRole) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    if (!this.isArchiveAdmin(activeRole)) {
      throw new ForbiddenException("The current role cannot manage archive history.");
    }
    return user;
  }

  private validateReportingPeriod(
    payload: Pick<CreateHistoricalArchiveDto | UpdateHistoricalArchiveDto, "reportingPeriodFrom" | "reportingPeriodTo">,
  ) {
    if (!payload.reportingPeriodFrom || !payload.reportingPeriodTo) {
      return;
    }

    const from = new Date(payload.reportingPeriodFrom);
    const to = new Date(payload.reportingPeriodTo);

    if (from.getTime() > to.getTime()) {
      throw new BadRequestException("Reporting period start date cannot be later than the end date.");
    }
  }

  private async createAuditEntry(params: {
    actorId: string;
    actorRole: UserRole;
    action: string;
    recordId: string;
    details: string;
    ipAddress?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    await this.prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        actorRole: displayRole(params.actorRole),
        action: params.action,
        recordType: "ARCHIVE",
        recordId: params.recordId,
        ipAddress: params.ipAddress ?? "unknown",
        details: params.details,
        metadata: params.metadata,
      },
    });
  }

  private async resolveVisibleRecords(userId: string, activeRole: UserRole, filters: ListArchiveRecordsDto) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);

    const where: Prisma.ArchiveRecordWhereInput = {
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.templateFamily ? { templateFamily: filters.templateFamily } : {}),
      ...(filters.scopeTrack ? { scopeTrack: filters.scopeTrack } : {}),
      ...(filters.wingId ? { wingId: filters.wingId } : {}),
      ...(filters.directorateId ? { directorateId: filters.directorateId } : {}),
      ...(filters.regionId ? { regionId: filters.regionId } : {}),
      ...(filters.zoneId ? { zoneId: filters.zoneId } : {}),
      ...(filters.circleId ? { circleId: filters.circleId } : {}),
      ...(filters.stationId ? { stationId: filters.stationId } : {}),
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.cellId ? { cellId: filters.cellId } : {}),
      ...(filters.officeId ? { officeId: filters.officeId } : {}),
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    };

    if (filters.query?.trim()) {
      const q = filters.query.trim();
      where.OR = [
        { employeeName: { contains: q, mode: "insensitive" } },
        { employeeServiceNumber: { contains: q, mode: "insensitive" } },
        { employeePosting: { contains: q, mode: "insensitive" } },
        { archiveReference: { contains: q, mode: "insensitive" } },
      ];
    }

    const [records, total] = await Promise.all([
      this.prisma.archiveRecord.findMany({
        where,
        include: ARCHIVE_RECORD_INCLUDE,
        orderBy: [{ reportingPeriodTo: "desc" }, { createdAt: "desc" }],
        take: 100,
      }),
      this.prisma.archiveRecord.count({ where }),
    ]);

    const employeeSafe = activeRole === UserRole.EMPLOYEE;
    const visible = records
      .filter((record) => canAccessEmployee(user, record.employee))
      .map((record) => mapArchiveRecord(record, { employeeSafe }));

    return { items: visible, total };
  }

  async list(userId: string, activeRole: UserRole, filters: ListArchiveRecordsDto) {
    if (!this.isArchiveReader(activeRole)) {
      throw new ForbiddenException("The current role cannot access the archive.");
    }
    return this.resolveVisibleRecords(userId, activeRole, filters);
  }

  async detail(userId: string, activeRole: UserRole, id: string) {
    if (!this.isArchiveReader(activeRole)) {
      throw new ForbiddenException("The current role cannot access the archive.");
    }
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    const record = await this.prisma.archiveRecord.findUnique({
      where: { id },
      include: ARCHIVE_RECORD_INCLUDE,
    });

    if (!record) {
      throw new NotFoundException("Archive record not found.");
    }

    if (!canAccessEmployee(user, record.employee)) {
      throw new ForbiddenException("You are not allowed to access this archive record.");
    }

    return mapArchiveRecord(record, { employeeSafe: activeRole === UserRole.EMPLOYEE });
  }

  async uploadHistorical(userId: string, activeRole: UserRole, dto: CreateHistoricalArchiveDto, file?: Express.Multer.File, ipAddress?: string) {
    const actor = await this.requireArchiveAdmin(userId, activeRole);
    this.validateReportingPeriod(dto);

    if (!file) {
      throw new BadRequestException("A historical archive PDF is required.");
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      include: ARCHIVE_RECORD_INCLUDE.employee.include,
    });

    if (!employee) {
      throw new NotFoundException("Employee not found.");
    }

    const placeholder = await this.prisma.archiveRecord.create({
      data: {
        employeeId: employee.id,
        source: ArchiveRecordSource.HISTORICAL_UPLOAD,
        scopeTrack: employee.scopeTrack,
        templateFamily: dto.templateFamily ?? employee.templateFamily,
        reportingPeriodFrom: dto.reportingPeriodFrom ? new Date(dto.reportingPeriodFrom) : null,
        reportingPeriodTo: dto.reportingPeriodTo ? new Date(dto.reportingPeriodTo) : null,
        archiveReference: dto.archiveReference ?? null,
        positionTitle: employee.positionTitle,
        employeeName: employee.name,
        employeeServiceNumber: employee.serviceNumber,
        employeeCnic: employee.cnic,
        employeePosting: employee.posting,
        wingId: employee.wingId,
        directorateId: employee.directorateId,
        regionId: employee.regionId,
        zoneId: employee.zoneId,
        circleId: employee.circleId,
        stationId: employee.stationId,
        branchId: employee.branchId,
        cellId: employee.cellId,
        officeId: employee.officeId,
        departmentId: employee.departmentId,
        organizationSnapshot: {
          scopeTrack: employee.scopeTrack,
          wing: employee.wing?.name ?? null,
          directorate: employee.directorate?.name ?? null,
          region: employee.region?.name ?? null,
          zone: employee.zone?.name ?? null,
          circle: employee.circle?.name ?? null,
          station: employee.station?.name ?? null,
          branch: employee.branch?.name ?? null,
          cell: employee.cell?.name ?? null,
          office: employee.office.name,
          department: employee.department?.name ?? null,
        } as Prisma.InputJsonValue,
        documentPath: "pending-upload",
        remarks: dto.remarks ?? null,
        uploadedById: actor.id,
      },
      include: ARCHIVE_RECORD_INCLUDE,
    });

    const uploaded = await this.filesService.recordFile(actor.id, undefined, "DOCUMENT", file, placeholder.id);

    const record = await this.prisma.archiveRecord.update({
      where: { id: placeholder.id },
      data: {
        archiveReference: dto.archiveReference ?? uploaded.storagePath,
        documentPath: uploaded.storagePath,
      },
      include: ARCHIVE_RECORD_INCLUDE,
    });

    await this.createAuditEntry({
      actorId: actor.id,
      actorRole: activeRole,
      action: "Historical archive uploaded",
      recordId: record.id,
      ipAddress,
      details: `Historical ACR uploaded for ${record.employeeName}${record.reportingPeriodTo ? ` (${record.reportingPeriodTo.getUTCFullYear()})` : ""}.`,
      metadata: {
        employeeId: record.employeeId,
        source: record.source,
        archiveReference: record.archiveReference,
        reportingPeriodFrom: record.reportingPeriodFrom?.toISOString() ?? null,
        reportingPeriodTo: record.reportingPeriodTo?.toISOString() ?? null,
      } as Prisma.InputJsonValue,
    });

    return mapArchiveRecord(record);
  }

  async updateHistoricalMetadata(userId: string, activeRole: UserRole, id: string, dto: UpdateHistoricalArchiveDto, ipAddress?: string) {
    const actor = await this.requireArchiveAdmin(userId, activeRole);
    this.validateReportingPeriod(dto);
    const existing = await this.prisma.archiveRecord.findUnique({
      where: { id },
      include: ARCHIVE_RECORD_INCLUDE,
    });

    if (!existing) {
      throw new NotFoundException("Archive record not found.");
    }

    if (existing.source !== ArchiveRecordSource.HISTORICAL_UPLOAD) {
      throw new BadRequestException("Only historical uploads can be updated through this endpoint.");
    }

    const updated = await this.prisma.archiveRecord.update({
      where: { id },
      data: {
        templateFamily: dto.templateFamily ?? undefined,
        reportingPeriodFrom: dto.reportingPeriodFrom ? new Date(dto.reportingPeriodFrom) : undefined,
        reportingPeriodTo: dto.reportingPeriodTo ? new Date(dto.reportingPeriodTo) : undefined,
        archiveReference: dto.archiveReference ?? undefined,
        remarks: dto.remarks ?? undefined,
      },
      include: ARCHIVE_RECORD_INCLUDE,
    });

    await this.createAuditEntry({
      actorId: actor.id,
      actorRole: activeRole,
      action: "Historical archive metadata updated",
      recordId: updated.id,
      ipAddress,
      details: `Historical archive metadata updated for ${updated.employeeName}.`,
      metadata: {
        archiveReference: updated.archiveReference,
        templateFamily: updated.templateFamily,
        reportingPeriodFrom: updated.reportingPeriodFrom?.toISOString() ?? null,
        reportingPeriodTo: updated.reportingPeriodTo?.toISOString() ?? null,
      } as Prisma.InputJsonValue,
    });

    return mapArchiveRecord(updated);
  }

  async verifyHistorical(userId: string, activeRole: UserRole, id: string, remarks?: string, ipAddress?: string) {
    const actor = await this.requireArchiveAdmin(userId, activeRole);
    const existing = await this.prisma.archiveRecord.findUnique({
      where: { id },
      include: ARCHIVE_RECORD_INCLUDE,
    });

    if (!existing) {
      throw new NotFoundException("Archive record not found.");
    }

    const updated = await this.prisma.archiveRecord.update({
      where: { id },
      data: {
        isVerified: true,
        verifiedById: actor.id,
        verifiedAt: new Date(),
        remarks: remarks ?? existing.remarks,
      },
      include: ARCHIVE_RECORD_INCLUDE,
    });

    await this.createAuditEntry({
      actorId: actor.id,
      actorRole: activeRole,
      action: "Historical archive verified",
      recordId: updated.id,
      ipAddress,
      details: `Historical archive verified for ${updated.employeeName}.`,
      metadata: {
        verifiedAt: updated.verifiedAt?.toISOString() ?? null,
      } as Prisma.InputJsonValue,
    });

    return mapArchiveRecord(updated);
  }

  async deleteHistorical(userId: string, activeRole: UserRole, id: string, ipAddress?: string) {
    const actor = await this.requireArchiveAdmin(userId, activeRole);
    const existing = await this.prisma.archiveRecord.findUnique({
      where: { id },
      include: ARCHIVE_RECORD_INCLUDE,
    });

    if (!existing) {
      throw new NotFoundException("Archive record not found.");
    }

    if (existing.source !== ArchiveRecordSource.HISTORICAL_UPLOAD) {
      throw new BadRequestException("Only historical uploads can be deleted through this endpoint.");
    }

    const filePaths = existing.files.map((file) => file.storagePath);

    await this.prisma.$transaction(async (tx) => {
      await tx.fileAsset.deleteMany({
        where: { archiveRecordId: existing.id },
      });

      await tx.archiveRecord.delete({
        where: { id: existing.id },
      });

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorRole: displayRole(activeRole),
          action: "Historical archive deleted",
          recordType: "ARCHIVE",
          recordId: existing.id,
          ipAddress: ipAddress ?? "unknown",
          details: `Historical archive deleted for ${existing.employeeName}.`,
          metadata: {
            employeeId: existing.employeeId,
            archiveReference: existing.archiveReference,
          } as Prisma.InputJsonValue,
        },
      });
    });

    await Promise.all(filePaths.map((storedPath) => this.filesService.deleteStoredFile(storedPath)));

    return { success: true };
  }
}
