import { Bell, Monitor, Palette, Shield, User } from "lucide-react";
import type { UserDisplayPreferences, UserNotificationPreferences } from "@/types/contracts";

export type SettingsTab = "profile" | "notifications" | "security" | "display" | "system";

export const SETTINGS_TABS: Array<{ key: SettingsTab; label: string; icon: typeof User }> = [
  { key: "profile", label: "Profile", icon: User },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "security", label: "Security", icon: Shield },
  { key: "display", label: "Display", icon: Monitor },
  { key: "system", label: "Design System", icon: Palette },
];

export const DEFAULT_NOTIFICATION_PREFERENCES: UserNotificationPreferences = {
  acrSubmitted: true,
  acrReturned: true,
  overdueAlerts: true,
  priorityAlerts: true,
  systemUpdates: false,
  weeklyDigest: true,
};

export const DEFAULT_DISPLAY_PREFERENCES: UserDisplayPreferences = {
  compactSidebar: false,
  denseTables: false,
  reduceMotion: false,
};

export const COLOR_TOKENS = [
  { name: "--fia-navy", value: "#1A1C6E", sample: "#1A1C6E" },
  { name: "--fia-navy-500", value: "#2D308F", sample: "#2D308F" },
  { name: "--fia-cyan", value: "#0095D9", sample: "#0095D9" },
  { name: "--fia-success", value: "#16A34A", sample: "#16A34A" },
  { name: "--fia-warning", value: "#D97706", sample: "#D97706" },
  { name: "--fia-danger", value: "#DC2626", sample: "#DC2626" },
  { name: "--fia-gray-900", value: "#111827", sample: "#111827" },
  { name: "--fia-gray-200", value: "#E5E7EB", sample: "#E5E7EB" },
  { name: "--fia-gray-50", value: "#F9FAFB", sample: "#F9FAFB" },
];

export const SPACING_TOKENS = [
  { name: "--space-2", value: "8px" },
  { name: "--space-4", value: "16px" },
  { name: "--space-6", value: "24px" },
  { name: "--space-8", value: "32px" },
];

export const RADIUS_TOKENS = [
  { name: "--radius-sm", value: "6px" },
  { name: "--radius-md", value: "8px" },
  { name: "--radius-lg", value: "12px" },
  { name: "--radius-xl", value: "16px" },
  { name: "--radius-2xl", value: "20px" },
];

export const TYPOGRAPHY_TOKENS = [
  { name: "H1", value: "1.375rem / 600 / 1.4 lh" },
  { name: "H2", value: "1.125rem / 600 / 1.4 lh" },
  { name: "Body", value: "0.875rem / 400 / 1.5 lh" },
  { name: "Label", value: "0.8125rem / 500 / 1.5 lh" },
  { name: "Caption", value: "0.75rem / 400 / 1.5 lh" },
];

export const COMPONENT_VARIANTS = [
  { name: "StatCard", variants: "navy, cyan, green, amber, red, slate" },
  { name: "StatusChip", variants: "Draft, In Review, Pending RO, Pending CO, Overdue, Priority, Archived, Completed" },
  { name: "Button", variants: "Primary, Secondary, Quiet, Danger, Ghost" },
  { name: "Navigation", variants: "Expanded rail, collapsed rail, hover, active indicator" },
];
