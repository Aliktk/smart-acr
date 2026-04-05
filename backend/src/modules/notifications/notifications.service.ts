import { Injectable, NotFoundException } from "@nestjs/common";
import { NotificationType, Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma.service";
import { mapNotification } from "../../helpers/view-mappers";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    filters?: {
      type?: NotificationType;
      read?: "read" | "unread" | "all";
      linked?: "linked" | "system" | "all";
      query?: string;
    },
  ) {
    const where: Prisma.NotificationWhereInput = {
      OR: [{ userId }, { userId: null }],
    };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.read === "read") {
      where.readAt = { not: null };
    }

    if (filters?.read === "unread") {
      where.readAt = null;
    }

    if (filters?.linked === "linked") {
      where.acrRecordId = { not: null };
    }

    if (filters?.linked === "system") {
      where.acrRecordId = null;
    }

    if (filters?.query?.trim()) {
      const query = filters.query.trim();
      where.AND = [
        {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { message: { contains: query, mode: "insensitive" } },
            { acrRecord: { acrNo: { contains: query, mode: "insensitive" } } },
          ],
        },
      ];
    }

    const notifications = await this.prisma.notification.findMany({
      where,
      include: {
        acrRecord: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      items: notifications.map((notification) => mapNotification(notification)),
      total: notifications.length,
    };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: {
        readAt: null,
        OR: [{ userId }, { userId: null }],
      },
      data: { readAt: new Date() },
    });

    return { success: true };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        OR: [{ userId }, { userId: null }],
      },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found.");
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async dismiss(userId: string, notificationId: string) {
    const result = await this.prisma.notification.deleteMany({
      where: {
        id: notificationId,
        OR: [{ userId }, { userId: null }],
      },
    });

    if (result.count === 0) {
      throw new NotFoundException("Notification not found.");
    }

    return { success: true };
  }
}
