import { Suspense } from "react";
import { AuthForm } from "@/features/auth/auth-form";

export default function RegisterPage() {
  return (
    <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/55 p-5 shadow-[0_24px_60px_-35px_rgba(16,185,129,0.45)] backdrop-blur">
      <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
      <p className="text-sm text-slate-300">Sign up to join private channels, control playback, and manage invites.</p>
      <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
        <AuthForm mode="register" />
      </Suspense>
    </div>
  );
}
