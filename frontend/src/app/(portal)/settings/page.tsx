import { UserSettingsPage } from "@/components/settings/UserSettingsPage";
import type { SettingsTab } from "@/components/settings/constants";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = (await searchParams) ?? {};
  const requestedTab = typeof resolved.tab === "string" ? resolved.tab : "profile";
  const initialTab = (["profile", "notifications", "security", "display", "system"].includes(requestedTab)
    ? requestedTab
    : "profile") as SettingsTab;
  const forcePasswordChange = resolved.forcePassword === "1";

  return <UserSettingsPage initialTab={initialTab} forcePasswordChange={forcePasswordChange} />;
}
