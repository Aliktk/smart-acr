import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppShell } from "@/templates/AppShell";
import "./leaflet-styles.css";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AppShell>
  );
}
