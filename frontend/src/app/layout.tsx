import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "../providers/AppProviders";

export const metadata: Metadata = {
  title: "FIA Smart ACR / PER Management System",
  description: "Internal portal for FIA ACR/PER workflow, archive, and analytics.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png" },
      { url: "/logo.png", type: "image/png" },
    ],
    shortcut: "/logo.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
