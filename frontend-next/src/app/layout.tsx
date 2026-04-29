import "./globals.css";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
