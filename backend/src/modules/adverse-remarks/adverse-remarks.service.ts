import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AdverseRemarkStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { loadScopedUser } from "../../helpers/security.utils";
import { AuditWriterService } from "../audit/audit-writer.service";

const ADVERSE_REMARK_INCLUDE = {
  representation: {
    include: {
      decidedBy: { select: { id: true, displayName: true } },
    },
  },
} as const;

/** 30 days in milliseconds */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdverseRemarksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditWriter: AuditWriterService,
  ) {}

  /**
   * List adverse remarks for an ACR record.
   */
  async listByAcr(userId: string, activeRole: UserRole, acrRecordId: string) {
    await loadScopedUser(this.prisma, userId, activeRole);

    const remarks = await this.prisma.adverseRemark.findMany({
      where: { acrRecordId },
      include: ADVERSE_REMARK_INCLUDE,
      orderBy: { createdAt: "asc" },
    });

    return remarks.map((remark) => this.mapRemark(remark));
  }

  /**
   * Create an adverse remark. Only RO can create during PENDING_REPORTING.
   * FIA rule xv: counselling should be done before recording adverse remarks.
   */
  async createRemark(
    userId: string,
    activeRole: UserRole,
    acrRecordId: string,
    remarkText: string,
    counsellingDate?: string,
    counsellingNotes?: string,
    ipAddress = "0.0.0.0",
  ) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);

    if (
      activeRole !== UserRole.REPORTING_OFFICER &&
      activeRole !== UserRole.SUPER_ADMIN &&
      activeRole !== UserRole.IT_OPS
    ) {
      throw new ForbiddenException("Only Reporting Officers can record adverse remarks.");
    }

    const acr = await this.prisma.acrRecord.findUnique({
      where: { id: acrRecordId },
      select: { id: true, workflowState: true, reportingOfficerId: true },
    });

    if (!acr) {
      throw new NotFoundException("ACR not found.");
    }

    if (acr.workflowState !== "PENDING_REPORTING" && acr.workflowState !== "RETURNED_TO_REPORTING") {
      throw new BadRequestException("Adverse remarks can only be recorded during the reporting stage.");
    }

    const remark = await this.prisma.adverseRemark.create({
      data: {
        acrRecordId,
        remarkText,
        counsellingDate: counsellingDate ? new Date(counsellingDate) : null,
        counsellingNotes: counsellingNotes ?? null,
        status: AdverseRemarkStatus.DRAFT,
      },
      include: ADVERSE_REMARK_INCLUDE,
    });

    await this.prisma.acrRecord.update({
      where: { id: acrRecordId },
      data: { hasAdverseRemarks: true },
    });

    await this.auditWriter.write({
      actorId: user.id,
      acrRecordId,
      recordType: "ACR",
      recordId: acrRecordId,
      action: "Adverse Remark Created",
      actorRole: activeRole,
      ipAddress,
      details: `Adverse remark recorded by Reporting Officer.`,
    });

    return this.mapRemark(remark);
  }

  /**
   * CSO endorses an adverse remark (underlines in red ink per FIA rule xvi).
   * Sets communication deadline to 30 days from endorsement.
   */
  async endorseRemark(
    userId: string,
    activeRole: UserRole,
    remarkId: string,
    ipAddress = "0.0.0.0",
  ) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);

    if (
      activeRole !== UserRole.COUNTERSIGNING_OFFICER &&
      activeRole !== UserRole.SUPER_ADMIN &&
      activeRole !== UserRole.IT_OPS
    ) {
      throw new ForbiddenException("Only Countersigning Officers can endorse adverse remarks.");
    }

    const remark = await this.prisma.adverseRemark.findUnique({
      where: { id: remarkId },
      include: { acrRecord: { select: { workflowState: true } } },
    });

    if (!remark) {
      throw new NotFoundException("Adverse remark not found.");
    }

    if (remark.status !== AdverseRemarkStatus.DRAFT) {
      throw new BadRequestException("This remark has already been processed.");
    }

    const now = new Date();
    const updated = await this.prisma.adverseRemark.update({
      where: { id: remarkId },
      data: {
        endorsedByCso: true,
        endorsedAt: now,
        communicationDeadline: new Date(now.getTime() + THIRTY_DAYS_MS),
        status: AdverseRemarkStatus.ENDORSED_BY_CSO,
      },
      include: ADVERSE_REMARK_INCLUDE,
    });

    await this.auditWriter.write({
      actorId: user.id,
      acrRecordId: remark.acrRecordId,
      recordType: "ACR",
      recordId: remark.acrRecordId,
      action: "Adverse Remark Endorsed",
      actorRole: activeRole,
      ipAddress,
      details: `Adverse remark endorsed by Countersigning Officer.`,
    });

    return this.mapRemark(updated);
  }

  /**
   * Secret Branch communicates the adverse remark to the officer.
   * FIA rule xviii: must be within 1 month of countersigning.
   */
  async communicateRemark(
    userId: string,
    activeRole: UserRole,
    remarkId: string,
    ipAddress = "0.0.0.0",
  ) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);

    if (
      activeRole !== UserRole.SECRET_BRANCH &&
      activeRole !== UserRole.SUPER_ADMIN &&
      activeRole !== UserRole.IT_OPS
    ) {
      throw new ForbiddenException("Only Secret Branch can communicate adverse remarks.");
    }

    const remark = await this.prisma.adverseRemark.findUnique({
      where: { id: remarkId },
    });

    if (!remark) {
      throw new NotFoundException("Adverse remark not found.");
    }

    if (remark.status !== AdverseRemarkStatus.ENDORSED_BY_CSO) {
      throw new BadRequestException(
        "Only CSO-endorsed remarks can be communicated. Current status: " + remark.status,
      );
    }

    if (remark.communicationDeadline && new Date() > remark.communicationDeadline) {
      throw new BadRequestException(
        "Communication deadline has passed. The remark should have been communicated within one month of countersigning.",
      );
    }

    const now = new Date();
    const updated = await this.prisma.adverseRemark.update({
      where: { id: remarkId },
      data: {
        communicatedAt: now,
        status: AdverseRemarkStatus.COMMUNICATED,
      },
      include: ADVERSE_REMARK_INCLUDE,
    });

    await this.auditWriter.write({
      actorId: user.id,
      acrRecordId: remark.acrRecordId,
      recordType: "ACR",
      recordId: remark.acrRecordId,
      action: "Adverse Remark Communicated",
      actorRole: activeRole,
      ipAddress,
      details: `Adverse remark communicated to officer reported upon.`,
    });

    return this.mapRemark(updated);
  }

  /**
   * Officer acknowledges receipt of communicated adverse remark.
   * FIA rule xviii: acknowledgement of receipt should be taken.
   * The 30-day representation window starts from acknowledgement.
   */
  async acknowledgeRemark(
    userId: string,
    activeRole: UserRole,
    remarkId: string,
    ipAddress = "0.0.0.0",
  ) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);

    if (activeRole !== UserRole.EMPLOYEE && activeRole !== UserRole.SUPER_ADMIN && activeRole !== UserRole.IT_OPS) {
      throw new ForbiddenException("Only the officer reported upon can acknowledge adverse remarks.");
    }

    const remark = await this.prisma.adverseRemark.findUnique({ where: { id: remarkId } });

    if (!remark) {
      throw new NotFoundException("Adverse remark not found.");
    }

    if (remark.status !== AdverseRemarkStatus.COMMUNICATED) {
      throw new BadRequestException("Only communicated remarks can be acknowledged.");
    }

    const now = new Date();
    const updated = await this.prisma.adverseRemark.update({
      where: { id: remarkId },
      data: {
        acknowledgedAt: now,
        acknowledgedById: user.id,
        status: AdverseRemarkStatus.ACKNOWLEDGED,
      },
      include: ADVERSE_REMARK_INCLUDE,
    });

    await this.auditWriter.write({
      actorId: user.id,
      acrRecordId: remark.acrRecordId,
      recordType: "ACR",
      recordId: remark.acrRecordId,
      action: "Adverse Remark Acknowledged",
      actorRole: activeRole,
      ipAddress,
      details: `Officer acknowledged receipt of adverse remark.`,
    });

    return this.mapRemark(updated);
  }

  /**
   * Officer submits a representation against adverse remarks.
   * FIA rule xix: within 30 days of receipt (from acknowledgement date).
   */
  async submitRepresentation(
    userId: string,
    activeRole: UserRole,
    remarkId: string,
    representationText: string,
    ipAddress = "0.0.0.0",
  ) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    const remark = await this.prisma.adverseRemark.findUnique({
      where: { id: remarkId },
    });

    if (!remark) {
      throw new NotFoundException("Adverse remark not found.");
    }

    if (remark.status !== AdverseRemarkStatus.ACKNOWLEDGED) {
      throw new BadRequestException(
        "Representation can only be submitted after acknowledging receipt of the adverse remark. Please acknowledge first.",
      );
    }

    if (!remark.acknowledgedAt) {
      throw new BadRequestException("Acknowledgement date is not recorded for this remark.");
    }

    const deadlineBase = remark.acknowledgedAt;

    const representationDeadline = new Date(deadlineBase.getTime() + THIRTY_DAYS_MS);
    if (new Date() > representationDeadline) {
      throw new BadRequestException(
        "The 30-day representation window has expired.",
      );
    }

    const now = new Date();
    await this.prisma.adverseRepresentation.create({
      data: {
        adverseRemarkId: remarkId,
        representationText,
        receivedAt: now,
        representationDeadline,
      },
    });

    const updated = await this.prisma.adverseRemark.update({
      where: { id: remarkId },
      data: { status: AdverseRemarkStatus.REPRESENTATION_RECEIVED },
      include: ADVERSE_REMARK_INCLUDE,
    });

    await this.auditWriter.write({
      actorId: user.id,
      acrRecordId: remark.acrRecordId,
      recordType: "ACR",
      recordId: remark.acrRecordId,
      action: "Representation Submitted",
      actorRole: activeRole,
      ipAddress,
      details: `Officer submitted representation against adverse remark.`,
    });

    return this.mapRemark(updated);
  }

  /**
   * Authority next higher than CSO decides on the representation.
   * FIA rule xx: competent authority gives own assessment for expunged entries.
   */
  async decideRepresentation(
    userId: string,
    activeRole: UserRole,
    remarkId: string,
    decision: string,
    decisionNotes: string,
    ipAddress = "0.0.0.0",
  ) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);

    if (
      activeRole !== UserRole.DG &&
      activeRole !== UserRole.WING_OVERSIGHT &&
      activeRole !== UserRole.ZONAL_OVERSIGHT &&
      activeRole !== UserRole.SUPER_ADMIN &&
      activeRole !== UserRole.IT_OPS
    ) {
      throw new ForbiddenException(
        "Only the authority next higher than the Countersigning Officer can decide on representations.",
      );
    }

    const remark = await this.prisma.adverseRemark.findUnique({
      where: { id: remarkId },
      include: { representation: true },
    });

    if (!remark) {
      throw new NotFoundException("Adverse remark not found.");
    }

    if (remark.status !== AdverseRemarkStatus.REPRESENTATION_RECEIVED || !remark.representation) {
      throw new BadRequestException("No representation has been received for this adverse remark.");
    }

    const now = new Date();
    await this.prisma.adverseRepresentation.update({
      where: { id: remark.representation.id },
      data: {
        decidedById: user.id,
        decision,
        decisionDate: now,
        decisionNotes,
      },
    });

    const updated = await this.prisma.adverseRemark.update({
      where: { id: remarkId },
      data: { status: AdverseRemarkStatus.REPRESENTATION_DECIDED },
      include: ADVERSE_REMARK_INCLUDE,
    });

    await this.auditWriter.write({
      actorId: user.id,
      acrRecordId: remark.acrRecordId,
      recordType: "ACR",
      recordId: remark.acrRecordId,
      action: "Representation Decided",
      actorRole: activeRole,
      ipAddress,
      details: `Representation decided: ${decision}`,
    });

    return this.mapRemark(updated);
  }

  private mapRemark(remark: {
    id: string;
    acrRecordId: string;
    remarkText: string;
    counsellingDate: Date | null;
    counsellingNotes: string | null;
    endorsedByCso: boolean;
    endorsedAt: Date | null;
    communicatedAt: Date | null;
    communicationDeadline: Date | null;
    acknowledgedAt?: Date | null;
    acknowledgedById?: string | null;
    status: AdverseRemarkStatus;
    createdAt: Date;
    representation?: {
      id: string;
      representationText: string;
      receivedAt: Date;
      representationDeadline: Date;
      decision: string | null;
      decisionDate: Date | null;
      decisionNotes: string | null;
      decidedBy?: { id: string; displayName: string } | null;
    } | null;
  }) {
    return {
      id: remark.id,
      acrRecordId: remark.acrRecordId,
      remarkText: remark.remarkText,
      counsellingDate: remark.counsellingDate?.toISOString() ?? null,
      counsellingNotes: remark.counsellingNotes,
      endorsedByCso: remark.endorsedByCso,
      endorsedAt: remark.endorsedAt?.toISOString() ?? null,
      communicatedAt: remark.communicatedAt?.toISOString() ?? null,
      acknowledgedAt: remark.acknowledgedAt?.toISOString() ?? null,
      communicationDeadline: remark.communicationDeadline?.toISOString() ?? null,
      status: remark.status,
      createdAt: remark.createdAt.toISOString(),
      representation: remark.representation
        ? {
            id: remark.representation.id,
            representationText: remark.representation.representationText,
            receivedAt: remark.representation.receivedAt.toISOString(),
            representationDeadline: remark.representation.representationDeadline.toISOString(),
            decision: remark.representation.decision,
            decisionDate: remark.representation.decisionDate?.toISOString() ?? null,
            decisionNotes: remark.representation.decisionNotes,
            decidedByName: remark.representation.decidedBy?.displayName ?? null,
          }
        : null,
    };
  }
}
