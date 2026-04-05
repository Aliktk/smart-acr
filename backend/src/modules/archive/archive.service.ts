import { Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { canAccessAcr, loadScopedUser } from "../../helpers/security.utils";
import { mapAcr } from "../../helpers/view-mappers";
import { WorkflowService } from "../workflow/workflow.service";

@Injectable()
export class ArchiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowService: WorkflowService,
  ) {}

  async list(userId: string, activeRole: UserRole) {
    const user = await loadScopedUser(this.prisma, userId, activeRole);
    const archived = await this.prisma.acrRecord.findMany({
      where: {
        workflowState: { in: ["ARCHIVED"] },
      },
      include: {
        employee: { include: { wing: true, zone: true, office: true } },
        initiatedBy: true,
        currentHolder: true,
        reportingOfficer: true,
        countersigningOfficer: true,
        timeline: {
          select: {
            actorId: true,
          },
        },
        templateVersion: true,
        archiveSnapshot: true,
      },
      orderBy: { archivedAt: "desc" },
    });

    const visible = archived.filter((record) => canAccessAcr(user, record));

    return {
      items: visible.map((record) => ({
        ...mapAcr(record, this.workflowService),
        archiveReference: record.archiveSnapshot?.documentPath ?? null,
      })),
      total: visible.length,
    };
  }
}
