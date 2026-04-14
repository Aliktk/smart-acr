import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppShell } from "@/templates/AppShell";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AppShell>
  );
}
