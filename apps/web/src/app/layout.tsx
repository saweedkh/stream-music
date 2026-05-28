import "./globals.css";
import type { ReactNode } from "react";
import { CapacitorBootstrap } from "@/components/capacitor/capacitor-bootstrap";
import { AppShell } from "@/components/layout/app-shell";
import { DesignSystemProvider } from "@/components/providers/design-system-provider";
import { LocaleInitScript } from "@/components/providers/locale-init-script";
import { LocaleProvider } from "@/components/providers/locale-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

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
