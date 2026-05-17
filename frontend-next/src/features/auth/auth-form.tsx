"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/components/providers/locale-provider";
import { useToast } from "@/components/ui/toast-provider";
import { loginUser, registerUser } from "@/lib/api";
import { authLoginSchema, authRegisterSchema } from "@/lib/validation";

type Mode = "login" | "register";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const { t } = useTranslations();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ username?: boolean; email?: boolean; password?: boolean }>({});

  async function onSubmit() {
    setBusy(true);
    setError(null);
    const parseResult =
      mode === "register"
        ? authRegisterSchema.safeParse({ username, email, password })
        : authLoginSchema.safeParse({ username, password });
    const nextErrors: { username?: string; email?: string; password?: string } = {};
    if (!parseResult.success) {
      for (const issue of parseResult.error.issues) {
        const field = String(issue.path[0] ?? "");
        if (field === "username" || field === "email" || field === "password") {
          nextErrors[field] = issue.message;
        }
      }
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      showToast(t("auth.fixFields"), "error");
      setBusy(false);
      return;
    }
    try {
      if (mode === "register") {
        await registerUser(username, email, password);
      } else {
        await loginUser(username, password);
      }
      window.location.href = safeNextPath(searchParams.get("next"));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : mode === "register"
            ? t("auth.registerFailed")
            : t("auth.invalidCredentials");
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-border/90 bg-card/40 shadow-none">
      <CardHeader className="border-b border-border/80 bg-gradient-to-r from-[var(--brand-subtle)] to-transparent pb-4">
        <CardTitle>{mode === "register" ? t("auth.createAccount") : t("auth.login")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="auth-username">{t("auth.username")}</Label>
          <Input
            id="auth-username"
            placeholder={t("auth.username")}
            value={username}
            aria-invalid={Boolean(fieldErrors.username)}
            valid={Boolean(touched.username && username.trim())}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, username: true }))}
          />
          {fieldErrors.username ? <p className="text-xs text-rose-400">{fieldErrors.username}</p> : null}
        </div>
        {mode === "register" ? (
          <div className="space-y-1">
            <Label htmlFor="auth-email">{t("auth.emailOptional")}</Label>
            <Input
              id="auth-email"
              placeholder={t("auth.email")}
              value={email}
              aria-invalid={Boolean(fieldErrors.email)}
              valid={Boolean(touched.email && email && email.includes("@"))}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
            />
            {fieldErrors.email ? <p className="text-xs text-rose-400">{fieldErrors.email}</p> : null}
          </div>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor="auth-password">{t("auth.password")}</Label>
          <Input
            id="auth-password"
            type="password"
            placeholder={t("auth.password")}
            value={password}
            aria-invalid={Boolean(fieldErrors.password)}
            valid={Boolean(touched.password && password.trim())}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
          />
          {fieldErrors.password ? <p className="text-xs text-rose-400">{fieldErrors.password}</p> : null}
        </div>
        <Button className="w-full" onClick={onSubmit} disabled={busy || !username || !password}>
          {busy ? t("auth.pleaseWait") : mode === "register" ? t("auth.signUp") : t("auth.login")}
        </Button>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <p className="text-center text-xs text-muted-foreground">
          {mode === "register" ? (
            <>
              {t("auth.alreadyHaveAccount")}{" "}
              <Link href="/login" className="text-brand hover:text-brand">
                {t("auth.login")}
              </Link>
            </>
          ) : (
            <>
              {t("auth.needAccount")}{" "}
              <Link href="/register" className="text-brand hover:text-brand">
                {t("auth.register")}
              </Link>
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
