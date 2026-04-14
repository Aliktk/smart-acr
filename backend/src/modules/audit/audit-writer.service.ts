import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";

export interface AuditEntry {
  actorId: string;
  actorRole: string;
  ipAddress: string;
  action: string;
  details: string;
  recordType: string;
  recordId: string;
  acrRecordId?: string | null;
  metadata?: Record<string, unknown> | null;
}

@Injectable()
export class AuditWriterService {
  constructor(private readonly prisma: PrismaService) {}

  async write(entry: AuditEntry) {
    return this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        ipAddress: entry.ipAddress,
        action: entry.action,
        details: entry.details,
        recordType: entry.recordType,
        recordId: entry.recordId,
        acrRecordId: entry.acrRecordId ?? null,
        metadata: (entry.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });
  }
}
