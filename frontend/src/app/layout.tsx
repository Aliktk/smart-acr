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
  // Static inline script to prevent flash of wrong theme on page load.
  // Content is a hardcoded string literal — no user input, no XSS risk.
  const themeScript = `(function(){try{var t=localStorage.getItem('fia-theme');if(t==='dark')document.documentElement.classList.add('dark')}catch(e){}})()`;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
