"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { useTranslations } from "@/components/providers/locale-provider";
import { useToast } from "@/components/ui/toast-provider";
import { AuthSocialButtons } from "@/features/auth/auth-social-buttons";
import { loginUser, registerUser } from "@/lib/api";
import { authShakeKeyframes, staggerContainer, staggerItem } from "@/lib/motion";
import { authLoginSchema, authRegisterSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

function authHref(mode: Mode, next: string | null): string {
  const base = mode === "login" ? "/login" : "/register";
  if (!next || !next.startsWith("/") || next.startsWith("//")) return base;
  return `${base}?next=${encodeURIComponent(next)}`;
}

function AuthField({
  id,
  label,
  icon,
  error,
  children,
  focused,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  error?: string;
  children: ReactNode;
  focused?: boolean;
}) {
  return (
    <div className="auth-field">
      <label htmlFor={id} className="auth-field-label">
        {label}
      </label>
      <div className={cn("auth-field-control", focused && "auth-field-control--focus", error && "auth-field-control--error")}>
        <span className="auth-field-icon">{icon}</span>
        {children}
      </div>
      {error ? <p className="auth-field-error">{error}</p> : null}
    </div>
  );
}

export function AuthForm({ mode }: { mode: Mode }) {
  const { t } = useTranslations();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; email?: string; password?: string }>({});
  const [focusedField, setFocusedField] = useState<"username" | "email" | "password" | null>("username");

  const next = searchParams.get("next");

  async function onSubmit() {
    setBusy(true);
    setError(null);
    const parseResult =
      mode === "register"
        ? authRegisterSchema(t).safeParse({ username, email, password })
        : authLoginSchema(t).safeParse({ username, password });
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
      setShakeKey((k) => k + 1);
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
      window.location.href = safeNextPath(next);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : mode === "register"
            ? t("auth.registerFailed")
            : t("auth.invalidCredentials");
      setError(message);
      setShakeKey((k) => k + 1);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      key={shakeKey}
      initial={false}
      animate={shakeKey > 0 && (error || Object.keys(fieldErrors).length > 0) ? authShakeKeyframes : undefined}
    >
      <motion.div className="auth-form-fields" variants={staggerContainer.variants} initial="hidden" animate="visible">
        <motion.div {...staggerItem}>
          <AuthField
            id="auth-username"
            label={t("auth.usernameOrEmail")}
            icon={<User className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />}
            error={fieldErrors.username}
            focused={focusedField === "username"}
          >
            <input
              id="auth-username"
              className="auth-field-input"
              placeholder="alexrivera"
              value={username}
              aria-invalid={Boolean(fieldErrors.username)}
              onFocus={() => setFocusedField("username")}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </AuthField>
        </motion.div>

        <AnimatePresence initial={false}>
          {mode === "register" ? (
            <motion.div
              key="email"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <AuthField
                id="auth-email"
                label={t("auth.emailOptional")}
                icon={<Mail className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />}
                error={fieldErrors.email}
                focused={focusedField === "email"}
              >
                <input
                  id="auth-email"
                  className="auth-field-input"
                  placeholder={t("auth.email")}
                  value={email}
                  aria-invalid={Boolean(fieldErrors.email)}
                  onFocus={() => setFocusedField("email")}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </AuthField>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div {...staggerItem}>
          <AuthField
            id="auth-password"
            label={t("auth.password")}
            icon={<Lock className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />}
            error={fieldErrors.password}
            focused={focusedField === "password"}
          >
            <input
              id="auth-password"
              className="auth-field-input auth-field-input--password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              aria-invalid={Boolean(fieldErrors.password)}
              onFocus={() => setFocusedField("password")}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
            />
            <button
              type="button"
              className="auth-field-eye"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          </AuthField>
        </motion.div>

        {mode === "login" ? (
          <motion.div {...staggerItem} className="auth-form-meta">
            <label className="auth-remember">
              <input
                type="checkbox"
                className="auth-checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>{t("auth.rememberMe")}</span>
            </label>
            <button
              type="button"
              className="auth-link"
              onClick={() => showToast(t("auth.forgotPasswordDisabled"), "error")}
            >
              {t("auth.forgotPassword")}
            </button>
          </motion.div>
        ) : null}

        <motion.div {...staggerItem}>
          <button type="button" className="auth-submit" onClick={onSubmit} disabled={busy || !username || !password}>
            {busy ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t("auth.pleaseWait")}
              </span>
            ) : mode === "login" ? (
              t("auth.signIn")
            ) : (
              t("auth.signUp")
            )}
          </button>
        </motion.div>

        <AnimatePresence>
          {error ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Alert tone="error">{error}</Alert>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div {...staggerItem}>
          <AuthSocialButtons />
        </motion.div>

        <motion.p {...staggerItem} className="auth-footer-text">
          {mode === "login" ? (
            <>
              {t("auth.newToStream")}{" "}
              <Link href={authHref("register", next)} className="auth-link">
                {t("auth.signUp")}
              </Link>
            </>
          ) : (
            <>
              {t("auth.alreadyHaveAccount")}{" "}
              <Link href={authHref("login", next)} className="auth-link">
                {t("auth.login")}
              </Link>
            </>
          )}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
