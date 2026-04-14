import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import type { Prisma, UserRole } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../common/prisma.service";
import { validateProfileImageUpload } from "../../common/upload.constants";
import { ACTIVE_USER_ASSET_SELECT, groupUserAssets } from "../../common/user-asset.mapper";
import { StorageService } from "../storage/storage.service";
import { UpdatePasswordDto } from "./dto/update-password.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdateSettingsPreferencesDto } from "./dto/update-settings-preferences.dto";
import { UpdateEmployeeProfileDto } from "./dto/update-employee-profile.dto";

const SETTINGS_EMPLOYEE_INCLUDE = {
  trainingCourses: true,
  languages: true,
} satisfies Prisma.EmployeeInclude;

type SettingsEmployeeRecord = Prisma.EmployeeGetPayload<{
  include: typeof SETTINGS_EMPLOYEE_INCLUDE;
}>;

const SETTINGS_USER_INCLUDE = {
  office: {
    select: {
      name: true,
    },
  },
  userAssets: {
    where: {
      isActive: true,
    },
    select: ACTIVE_USER_ASSET_SELECT,
    orderBy: {
      updatedAt: "desc",
    },
  },
  employeeProfiles: {
    include: SETTINGS_EMPLOYEE_INCLUDE,
    take: 1,
    orderBy: {
      createdAt: "asc",
    },
  },
} satisfies Prisma.UserInclude;

type SettingsUserRecord = Prisma.UserGetPayload<{
  include: typeof SETTINGS_USER_INCLUDE;
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
    private readonly storageService: StorageService,
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
        include: SETTINGS_USER_INCLUDE,
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
      include: SETTINGS_USER_INCLUDE,
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

    validateProfileImageUpload(file);

    const existingUser = await this.requireUser(userId);
    const storedAvatar = await this.storageService.saveUploadedFile(file, {
      directory: `avatars/${userId}`,
      fileNamePrefix: "avatar",
    });
    const previousAvatarPath = existingUser.avatarStoragePath;

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          avatarFileName: storedAvatar.originalName,
          avatarMimeType: storedAvatar.mimeType,
          avatarStoragePath: storedAvatar.filePath,
        },
        include: SETTINGS_USER_INCLUDE,
      });

      await this.storageService.deleteStoredFile(previousAvatarPath);
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
      await this.storageService.deleteStoredFile(storedAvatar.filePath);
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

    const absolutePath = await this.storageService.assertReadable(user.avatarStoragePath);

    return {
      absolutePath,
      fileName: user.avatarFileName ?? "profile-photo",
      mimeType: user.avatarMimeType ?? "application/octet-stream",
    };
  }

  async getReferencePostings(): Promise<string[]> {
    const setting = await this.prisma.adminSetting.findUnique({
      where: { key: "reference.postings" },
    });
    if (!setting?.value) return [];
    try {
      const parsed = typeof setting.value === "string" ? JSON.parse(setting.value) : setting.value;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async getReferenceZonesCircles(): Promise<string[]> {
    const setting = await this.prisma.adminSetting.findUnique({
      where: { key: "reference.zones_circles" },
    });
    if (!setting?.value) return [];
    try {
      const parsed = typeof setting.value === "string" ? JSON.parse(setting.value) : setting.value;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
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
      include: SETTINGS_USER_INCLUDE,
    });

    if (!user) {
      throw new UnauthorizedException("The current user session is no longer valid.");
    }

    return user;
  }

  async updateEmployeeProfile(userId: string, activeRole: UserRole, dto: UpdateEmployeeProfileDto, ipAddress?: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId },
    });

    if (employee) {
      // Linked employee record exists — update it directly
      await this.prisma.$transaction(async (tx) => {
        await tx.employee.update({
          where: { id: employee.id },
          data: {
            ...(dto.gender !== undefined && { gender: dto.gender }),
            ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
            ...(dto.fatherName !== undefined && { fatherName: dto.fatherName }),
            ...(dto.spouseName !== undefined && { spouseName: dto.spouseName }),
            ...(dto.mobile !== undefined && { mobile: dto.mobile }),
            ...(dto.basicPay !== undefined && { basicPay: dto.basicPay }),
            ...(dto.appointmentToBpsDate !== undefined && { appointmentToBpsDate: new Date(dto.appointmentToBpsDate) }),
            ...(dto.educationLevel !== undefined && { educationLevel: dto.educationLevel }),
            ...(dto.qualifications !== undefined && { qualifications: dto.qualifications }),
            ...(dto.deputationType !== undefined && { deputationType: dto.deputationType }),
            ...(dto.natureOfDuties !== undefined && { natureOfDuties: dto.natureOfDuties }),
            ...(dto.personnelNumber !== undefined && { personnelNumber: dto.personnelNumber }),
            ...(dto.serviceGroup !== undefined && { serviceGroup: dto.serviceGroup }),
            ...(dto.licenseType !== undefined && { licenseType: dto.licenseType }),
            ...(dto.vehicleType !== undefined && { vehicleType: dto.vehicleType }),
            ...(dto.trainingCoursesText !== undefined && { trainingCoursesText: dto.trainingCoursesText }),
          },
        });

        if (dto.trainingCourses !== undefined) {
          await tx.employeeTrainingCourse.deleteMany({ where: { employeeId: employee.id } });
          if (dto.trainingCourses.length > 0) {
            await tx.employeeTrainingCourse.createMany({
              data: dto.trainingCourses.map((c) => ({
                employeeId: employee.id,
                courseName: c.courseName,
                durationFrom: c.durationFrom ? new Date(c.durationFrom) : null,
                durationTo: c.durationTo ? new Date(c.durationTo) : null,
                institution: c.institution ?? null,
                country: c.country ?? null,
              })),
            });
          }
        }

        if (dto.languages !== undefined) {
          await tx.employeeLanguageProficiency.deleteMany({ where: { employeeId: employee.id } });
          if (dto.languages.length > 0) {
            await tx.employeeLanguageProficiency.createMany({
              data: dto.languages.map((l) => ({
                employeeId: employee.id,
                language: l.language,
                speaking: l.speaking,
                reading: l.reading,
                writing: l.writing,
              })),
            });
          }
        }
      });

      await this.createAuditEntry({
        actorId: userId,
        actorRole: this.displayRole(activeRole),
        action: "Employee profile self-updated",
        recordType: "EMPLOYEE",
        recordId: employee.id,
        details: "Employee updated their own service record metadata via profile settings.",
        ipAddress,
      });
    } else {
      // No linked employee record yet — persist the metadata on the User itself so
      // it can be used as pre-fill when a Clerk eventually creates the employee record.
      // Type cast required until prisma generate is run after the migration.
      await (this.prisma.user.update as unknown as (args: Record<string, unknown>) => Promise<unknown>)({
        where: { id: userId },
        data: {
          selfReportedMetadata: {
            gender: dto.gender ?? null,
            dateOfBirth: dto.dateOfBirth ?? null,
            joiningDate: dto.joiningDate ?? null,
            fatherName: dto.fatherName ?? null,
            spouseName: dto.spouseName ?? null,
            mobile: dto.mobile ?? null,
            basicPay: dto.basicPay ?? null,
            appointmentToBpsDate: dto.appointmentToBpsDate ?? null,
            educationLevel: dto.educationLevel ?? null,
            qualifications: dto.qualifications ?? null,
            deputationType: dto.deputationType ?? null,
            natureOfDuties: dto.natureOfDuties ?? null,
            personnelNumber: dto.personnelNumber ?? null,
            serviceGroup: dto.serviceGroup ?? null,
            licenseType: dto.licenseType ?? null,
            vehicleType: dto.vehicleType ?? null,
            trainingCoursesText: dto.trainingCoursesText ?? null,
            trainingCourses: dto.trainingCourses ?? null,
            languages: dto.languages ?? null,
          },
        },
      });

      await this.createAuditEntry({
        actorId: userId,
        actorRole: this.displayRole(activeRole),
        action: "Self-reported metadata saved",
        recordType: "USER",
        recordId: userId,
        details: "User saved service metadata before an employee record was created.",
        ipAddress,
      });
    }

    const updatedUser = await this.requireUser(userId);
    return this.mapUserSettings(updatedUser, activeRole);
  }

  private mapEmployeeProfile(employee: SettingsEmployeeRecord) {
    return {
      isLinked: true,
      id: employee.id,
      name: employee.name,
      rank: employee.rank,
      designation: employee.designation,
      bps: employee.bps,
      posting: employee.posting,
      mobile: employee.mobile,
      joiningDate: employee.joiningDate.toISOString(),
      serviceYears: employee.serviceYears,
      gender: employee.gender ?? null,
      dateOfBirth: employee.dateOfBirth?.toISOString() ?? null,
      basicPay: employee.basicPay ?? null,
      appointmentToBpsDate: employee.appointmentToBpsDate?.toISOString() ?? null,
      educationLevel: employee.educationLevel ?? null,
      qualifications: employee.qualifications ?? null,
      fatherName: employee.fatherName ?? null,
      spouseName: (employee as Record<string, unknown>).spouseName as string | null ?? null,
      deputationType: employee.deputationType ?? null,
      natureOfDuties: employee.natureOfDuties ?? null,
      personnelNumber: employee.personnelNumber ?? null,
      serviceGroup: employee.serviceGroup ?? null,
      licenseType: employee.licenseType ?? null,
      vehicleType: employee.vehicleType ?? null,
      trainingCoursesText: employee.trainingCoursesText ?? null,
      trainingCourses: employee.trainingCourses.map((c) => ({
        id: c.id,
        courseName: c.courseName,
        durationFrom: c.durationFrom?.toISOString() ?? null,
        durationTo: c.durationTo?.toISOString() ?? null,
        institution: c.institution ?? null,
        country: c.country ?? null,
      })),
      languages: employee.languages.map((l) => ({
        id: l.id,
        language: l.language,
        speaking: l.speaking,
        reading: l.reading,
        writing: l.writing,
      })),
    };
  }

  private mapSelfReportedProfile(user: SettingsUserRecord) {
    const raw = (user as unknown as Record<string, unknown>).selfReportedMetadata ?? null;
    const meta = this.parseRecord(raw as Prisma.JsonValue);
    const readStr = (key: string) => (typeof meta[key] === "string" ? (meta[key] as string) : null);
    const readNum = (key: string) => (typeof meta[key] === "number" ? (meta[key] as number) : null);
    const readArr = <T>(key: string): T[] => (Array.isArray(meta[key]) ? (meta[key] as T[]) : []);

    return {
      isLinked: false,
      id: "",
      name: user.displayName,
      rank: "",
      designation: "",
      bps: 0,
      posting: "",
      mobile: user.mobileNumber ?? "",
      joiningDate: readStr("joiningDate") ?? "",
      serviceYears: 0,
      gender: readStr("gender") as string | null,
      dateOfBirth: readStr("dateOfBirth"),
      basicPay: readNum("basicPay"),
      appointmentToBpsDate: readStr("appointmentToBpsDate"),
      educationLevel: readStr("educationLevel"),
      qualifications: readStr("qualifications"),
      fatherName: readStr("fatherName"),
      spouseName: readStr("spouseName"),
      deputationType: readStr("deputationType"),
      natureOfDuties: readStr("natureOfDuties"),
      personnelNumber: readStr("personnelNumber"),
      serviceGroup: readStr("serviceGroup"),
      licenseType: readStr("licenseType"),
      vehicleType: readStr("vehicleType"),
      trainingCoursesText: readStr("trainingCoursesText"),
      trainingCourses: readArr("trainingCourses"),
      languages: readArr("languages"),
    };
  }

  private mapUserSettings(user: SettingsUserRecord, activeRole: UserRole) {
    const notifications = this.readNotificationPreferences(user.notificationPreferences);
    const display = this.readDisplayPreferences(user.displayPreferences);
    const profileAssets = groupUserAssets(user.userAssets);
    const linkedEmployee = user.employeeProfiles[0] ?? null;

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
        signatureAsset: profileAssets.signature,
        stampAsset: profileAssets.stamp,
      },
      // Always non-null: linked employee record takes priority; falls back to self-reported metadata
      employeeProfile: linkedEmployee
        ? this.mapEmployeeProfile(linkedEmployee)
        : this.mapSelfReportedProfile(user),
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

    if (role === "EXECUTIVE_VIEWER") {
      return "DG Viewer";
    }

    if (role === "IT_OPS") {
      return "IT Ops";
    }

    return role
      .split("_")
      .map((segment) => segment[0] + segment.slice(1).toLowerCase())
      .join(" ");
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
