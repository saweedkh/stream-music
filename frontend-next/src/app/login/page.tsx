import { AuthForm } from "@/features/auth/auth-form";

export default function LoginPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="text-sm text-slate-300">Login to create channels, manage playback, and invite users.</p>
      <AuthForm mode="login" />
    </div>
  );
}
