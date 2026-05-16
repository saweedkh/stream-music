import "./globals.css";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

export const metadata = {
  manifest: "/manifest.json",
  themeColor: "#10b981",
  appleWebApp: { capable: true, title: "Stream Music" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
