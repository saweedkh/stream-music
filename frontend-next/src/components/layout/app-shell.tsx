"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast-provider";
import { getMe, logoutUser, type AuthUser } from "@/lib/api";

export function AppShell({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AuthUser | null>(null);

  useEffect(() => {
    getMe().then(setMe).catch(() => setMe(null));
  }, []);

  async function handleLogout() {
    try {
      await logoutUser();
    } finally {
      setMe(null);
      window.location.href = "/login";
    }
  }

  return (
    <ToastProvider>
      <div className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
          <Link href="/" className="text-lg font-semibold text-slate-100">
            Stream Music
          </Link>
          <nav className="flex items-center gap-3 text-sm text-slate-300">
            <Link href="/dashboard" className="hover:text-white">
              Dashboard
            </Link>
            {me ? (
              <>
                <span className="text-xs text-slate-400">@{me.username}</span>
                <Button variant="ghost" className="px-2 py-1 text-xs" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <Link href="/login" className="hover:text-white">
                Login
              </Link>
            )}
          </nav>
        </header>
        {children}
      </div>
    </ToastProvider>
  );
}
