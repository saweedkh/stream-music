import { Suspense } from "react";
import { AuthLayout } from "@/components/layout/auth-layout";
import { AuthForm } from "@/features/auth/auth-form";

export default function RegisterPage() {
  return (
    <AuthLayout title="Create your account" description="Sign up to join private channels, control playback, and manage invites.">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <AuthForm mode="register" />
      </Suspense>
    </AuthLayout>
  );
}
