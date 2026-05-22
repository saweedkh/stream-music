"use client";

import { cn } from "@/lib/utils";

export function AuthPanelLogo({ className }: { className?: string }) {
  return (
    <div className={cn("auth-panel-logo", className)}>
      <div className="auth-logo-bars" aria-hidden>
        <span className="auth-logo-bar" style={{ height: 16 }} />
        <span className="auth-logo-bar" style={{ height: 26 }} />
        <span className="auth-logo-bar auth-logo-bar--peak" style={{ height: 34 }} />
      </div>
      <p className="auth-logo-wordmark">
        <span>Stream</span> <span className="auth-logo-wordmark-accent">Music</span>
      </p>
    </div>
  );
}
