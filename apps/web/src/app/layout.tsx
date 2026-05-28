import "./globals.css";
import type { ReactNode } from "react";
import { CapacitorBootstrap } from "@/shared/capacitor/capacitor-bootstrap";
import { AppShell } from "@/shared/layout/app-shell";
import { DesignSystemProvider } from "@/shared/providers/design-system-provider";
import { LocaleInitScript } from "@/shared/providers/locale-init-script";
import { LocaleProvider } from "@/shared/providers/locale-provider";
import { ThemeProvider } from "@/shared/providers/theme-provider";

export const metadata = {
  manifest: "/manifest.json",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#07090f" },
  ],
  appleWebApp: { capable: true, title: "Beat Room" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <LocaleInitScript />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <CapacitorBootstrap />
        <LocaleProvider>
          <ThemeProvider>
            <DesignSystemProvider>
              <AppShell>{children}</AppShell>
            </DesignSystemProvider>
          </ThemeProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
