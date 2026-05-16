import { Suspense } from "react";
import { AuthLayout } from "@/components/layout/auth-layout";
import { AuthForm } from "@/features/auth/auth-form";

export default function LoginPage() {
  return (
    <AuthLayout title="Welcome back" description="Login to create channels, manage playback, and invite listeners.">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <AuthForm mode="login" />
      </Suspense>
    </AuthLayout>
  );
}
