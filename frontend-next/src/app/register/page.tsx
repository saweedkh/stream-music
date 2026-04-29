import { AuthForm } from "@/features/auth/auth-form";

export default function RegisterPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="text-sm text-slate-300">Sign up to join private channels, control playback, and manage invites.</p>
      <AuthForm mode="register" />
    </div>
  );
}
