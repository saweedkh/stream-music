import "./globals.css";
import type { ReactNode } from "react";
import { Inter, Outfit } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { DesignSystemProvider } from "@/components/providers/design-system-provider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata = {
  manifest: "/manifest.json",
  themeColor: "#10b981",
  appleWebApp: { capable: true, title: "Stream Music" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="font-sans" suppressHydrationWarning>
        <DesignSystemProvider>
          <AppShell>{children}</AppShell>
        </DesignSystemProvider>
      </body>
    </html>
  );
}
