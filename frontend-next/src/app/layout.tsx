import "./globals.css";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { DesignSystemProvider } from "@/components/providers/design-system-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

export const metadata = {
  manifest: "/manifest.json",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#07090f" },
  ],
  appleWebApp: { capable: true, title: "Stream Music" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <DesignSystemProvider>
            <AppShell>{children}</AppShell>
          </DesignSystemProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
