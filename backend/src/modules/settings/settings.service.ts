import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { PrismaService } from "../../common/prisma.service";
import { UpdatePasswordDto } from "./dto/update-password.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdateSettingsPreferencesDto } from "./dto/update-settings-preferences.dto";

type SettingsUserRecord = Prisma.UserGetPayload<{
  include: {
    office: {
      select: {
        name: true;
      };
    };
  };
}>;

type NotificationPreferences = {
  acrSubmitted: boolean;
  acrReturned: boolean;
  overdueAlerts: boolean;
  priorityAlerts: boolean;
  systemUpdates: boolean;
  weeklyDigest: boolean;
};

type DisplayPreferences = {
  compactSidebar: boolean;
  denseTables: boolean;
  reduceMotion: boolean;
};

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  acrSubmitted: true,
  acrReturned: true,
  overdueAlerts: true,
  priorityAlerts: true,
  systemUpdates: false,
  weeklyDigest: true,
};

const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  compactSidebar: false,
  denseTables: false,
  reduceMotion: false,
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getUserSettings(userId: string, activeRole: UserRole) {
    const user = await this.requireUser(userId);
    return this.mapUserSettings(user, activeRole);
  }

  async updateProfile(userId: string, activeRole: UserRole, dto: UpdateProfileDto, ipAddress?: string) {
    const normalizedDisplayName = dto.displayName.trim().replace(/\s+/g, " ");
    const normalizedEmail = dto.email.trim().toLowerCase();

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          displayName: normalizedDisplayName,
          email: normalizedEmail,
        },
        include: {
          office: {
            select: {
              name: true,
            },
          },
        },
      });

      await this.createAuditEntry({
        actorId: userId,
        actorRole: this.displayRole(activeRole),
        action: "Profile updated",
        recordType: "USER",
        recordId: userId,
        details: `Profile details updated for ${normalizedDisplayName}.`,
        ipAddress,
      });

      return this.mapUserSettings(user, activeRole);
    } catch (error) {
      this.rethrowUniqueConstraint(error, "The selected email address is already assigned to another account.");
      throw error;
    }
  }

  async updatePreferences(userId: string, activeRole: UserRole, dto: UpdateSettingsPreferencesDto, ipAddress?: string) {
    const currentUser = await this.requireUser(userId);
    const nextNotifications = dto.notifications
      ? {
          ...this.readNotificationPreferences(currentUser.notificationPreferences),
          ...dto.notifications,
        }
      : this.readNotificationPreferences(currentUser.notificationPreferences);
    const nextDisplay = dto.display
      ? {
          ...this.readDisplayPreferences(currentUser.displayPreferences),
          ...dto.display,
        }
      : this.readDisplayPreferences(currentUser.displayPreferences);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        notificationPreferences: nextNotifications,
        displayPreferences: nextDisplay,
        twoFactorEnabled: dto.security?.twoFactorEnabled ?? currentUser.twoFactorEnabled,
      },
      include: {
        office: {
          select: {
            name: true,
          },
        },
      },
    });

    await this.createAuditEntry({
      actorId: userId,
      actorRole: this.displayRole(activeRole),
      action: "Preferences updated",
      recordType: "USER",
      recordId: userId,
      details: "Notification, display, or security preferences were updated.",
      ipAddress,
    });

    return this.mapUserSettings(updated, activeRole);
  }

  async updatePassword(userId: string, activeRole: UserRole, dto: UpdatePasswordDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        passwordHash: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("The current user session is no longer valid.");
    }

    const passwordMatches = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("The current password is incorrect.");
    }

    if (dto.currentPassword === dto.nextPassword) {
      throw new BadRequestException("The new password must be different from the current password.");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(dto.nextPassword, 12),
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      },
    });

    await this.createAuditEntry({
      actorId: userId,
      actorRole: this.displayRole(activeRole),
      action: "Password updated",
      recordType: "USER",
      recordId: userId,
      details: "User password was changed successfully.",
      ipAddress,
    });

    return {
      success: true,
      message: "Password updated successfully.",
    };
  }

  async updateAvatar(userId: string, activeRole: UserRole, file?: Express.Multer.File, ipAddress?: string) {
    if (!file) {
      throw new BadRequestException("A profile photo file is required.");
    }

    const existingUser = await this.requireUser(userId);
    const nextAvatarPath = this.toStorageRelativePath(file.path);
    const previousAvatarPath = existingUser.avatarStoragePath;

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          avatarFileName: file.originalname,
          avatarMimeType: file.mimetype,
          avatarStoragePath: nextAvatarPath,
        },
        include: {
          office: {
            select: {
              name: true,
            },
          },
        },
      });

      await this.deleteStoredFile(previousAvatarPath);
      await this.createAuditEntry({
        actorId: userId,
        actorRole: this.displayRole(activeRole),
        action: "Profile avatar updated",
        recordType: "USER",
        recordId: userId,
        details: `Profile avatar uploaded: ${file.originalname}.`,
        ipAddress,
      });

      return this.mapUserSettings(updated, activeRole);
    } catch (error) {
      await this.deleteStoredFile(nextAvatarPath);
      throw error;
    }
  }

  async getAvatarFile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        avatarFileName: true,
        avatarMimeType: true,
        avatarStoragePath: true,
      },
    });

    if (!user?.avatarStoragePath) {
      throw new NotFoundException("No profile photo has been uploaded yet.");
    }

    const absolutePath = this.resolveStoragePath(user.avatarStoragePath);

    try {
      await fs.access(absolutePath);
    } catch {
      throw new NotFoundException("The stored profile photo could not be found.");
    }

    return {
      absolutePath,
      fileName: user.avatarFileName ?? "profile-photo",
      mimeType: user.avatarMimeType ?? "application/octet-stream",
    };
  }

  async list() {
    return this.prisma.adminSetting.findMany({
      orderBy: { key: "asc" },
    });
  }

  async update(userId: string, key: string, value: string, ipAddress?: string) {
    const updated = await this.prisma.adminSetting.upsert({
      where: { key },
      create: { key, value, updatedById: userId },
      update: { value, updatedById: userId },
    });

    await this.createAuditEntry({
      actorId: userId,
      actorRole: "Administrator",
      action: "Admin setting updated",
      recordType: "SETTING",
      recordId: key,
      details: `System setting ${key} was updated.`,
      ipAddress,
    });

    return updated;
  }

  private async requireUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        office: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException("The current user session is no longer valid.");
    }

    return user;
  }

  private mapUserSettings(user: SettingsUserRecord, activeRole: UserRole) {
    const notifications = this.readNotificationPreferences(user.notificationPreferences);
    const display = this.readDisplayPreferences(user.displayPreferences);

    return {
      profile: {
        id: user.id,
        fullName: user.displayName,
        badgeNo: user.badgeNo,
        email: user.email,
        officeName: user.office?.name ?? "Unassigned office",
        roleLabel: this.displayRole(activeRole),
        hasAvatar: Boolean(user.avatarStoragePath),
        avatarVersion: user.updatedAt.toISOString(),
      },
      notifications,
      display,
      security: {
        twoFactorEnabled: user.twoFactorEnabled,
        passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
      },
    };
  }

  private readNotificationPreferences(value: Prisma.JsonValue | null | undefined): NotificationPreferences {
    const source = this.parseRecord(value);

    return {
      acrSubmitted: this.readBoolean(source.acrSubmitted, DEFAULT_NOTIFICATION_PREFERENCES.acrSubmitted),
      acrReturned: this.readBoolean(source.acrReturned, DEFAULT_NOTIFICATION_PREFERENCES.acrReturned),
      overdueAlerts: this.readBoolean(source.overdueAlerts, DEFAULT_NOTIFICATION_PREFERENCES.overdueAlerts),
      priorityAlerts: this.readBoolean(source.priorityAlerts, DEFAULT_NOTIFICATION_PREFERENCES.priorityAlerts),
      systemUpdates: this.readBoolean(source.systemUpdates, DEFAULT_NOTIFICATION_PREFERENCES.systemUpdates),
      weeklyDigest: this.readBoolean(source.weeklyDigest, DEFAULT_NOTIFICATION_PREFERENCES.weeklyDigest),
    };
  }

  private readDisplayPreferences(value: Prisma.JsonValue | null | undefined): DisplayPreferences {
    const source = this.parseRecord(value);

    return {
      compactSidebar: this.readBoolean(source.compactSidebar, DEFAULT_DISPLAY_PREFERENCES.compactSidebar),
      denseTables: this.readBoolean(source.denseTables, DEFAULT_DISPLAY_PREFERENCES.denseTables),
      reduceMotion: this.readBoolean(source.reduceMotion, DEFAULT_DISPLAY_PREFERENCES.reduceMotion),
    };
  }

  private parseRecord(value: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, Prisma.JsonValue>;
  }

  private readBoolean(value: Prisma.JsonValue | undefined, fallback: boolean) {
    return typeof value === "boolean" ? value : fallback;
  }

  private rethrowUniqueConstraint(error: unknown, message: string): never | void {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      throw new ConflictException(message);
    }
  }

  private displayRole(role: UserRole) {
    if (role === "DG") {
      return "DG";
    }

    if (role === "IT_OPS") {
      return "IT Ops";
    }

    return role
      .split("_")
      .map((segment) => segment[0] + segment.slice(1).toLowerCase())
      .join(" ");
  }

  private storageRoot() {
    return path.resolve(process.cwd(), this.configService.get("STORAGE_PATH") ?? "storage");
  }

  private toStorageRelativePath(filePath: string) {
    const storageRoot = this.storageRoot();
    const absoluteFilePath = path.resolve(filePath);
    const relativePath = path.relative(storageRoot, absoluteFilePath);

    if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new BadRequestException("The uploaded profile photo was stored outside the managed storage directory.");
    }

    return relativePath.replaceAll("\\", "/");
  }

  private resolveStoragePath(relativePath: string) {
    const storageRoot = this.storageRoot();
    const absolutePath = path.resolve(storageRoot, relativePath);
    const storagePrefix = `${storageRoot}${path.sep}`;

    if (absolutePath !== storageRoot && !absolutePath.startsWith(storagePrefix)) {
      throw new NotFoundException("The requested profile photo path is invalid.");
    }

    return absolutePath;
  }

  private async deleteStoredFile(relativePath?: string | null) {
    if (!relativePath) {
      return;
    }

    try {
      await fs.unlink(this.resolveStoragePath(relativePath));
    } catch (error) {
      const errorCode =
        typeof error === "object" && error !== null && "code" in error ? (error as { code?: string }).code : undefined;

      if (errorCode !== "ENOENT") {
        throw error;
      }
    }
  }

  private async createAuditEntry(params: {
    actorId: string;
    actorRole: string;
    action: string;
    recordType?: string;
    recordId?: string;
    details: string;
    ipAddress?: string;
  }) {
    await this.prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        actorRole: params.actorRole,
        recordType: params.recordType,
        recordId: params.recordId,
        ipAddress: params.ipAddress ?? "unknown",
        details: params.details,
      },
    });
  }
}
