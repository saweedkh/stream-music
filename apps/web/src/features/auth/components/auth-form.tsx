"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Gift, Loader2, Lock, Mail, User } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { AuthSocialButtons } from "@/features/auth/components/auth-social-buttons";
import { loginUser, registerUser } from "@/lib/api";
import { authShakeKeyframes, staggerContainer, staggerItem } from "@/lib/motion";
import { authLoginSchema, authRegisterSchema } from "@/lib/validation";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

function AuthField({
  id,
  label,
  icon,
  error,
  children,
  focused,
  required,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  error?: string;
  children: ReactNode;
  focused?: boolean;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
        {required && <span className="text-red-400 ms-0.5">*</span>}
      </label>
      <div
        className={cn(
          "relative flex items-center rounded-xl border bg-slate-100 transition-all duration-200 dark:bg-[#13161d]",
          focused
            ? "border-brand bg-brand/[0.03] shadow-[0_0_0_3px_rgba(34,197,94,0.15),0_0_20px_-4px_rgba(34,197,94,0.2)]"
            : "border-black/[0.08] dark:border-white/[0.07]",
          error && "border-red-500/60 shadow-[0_0_0_2px_rgba(239,68,68,0.15)]",
        )}
      >
        <span className={cn("flex w-11 shrink-0 items-center justify-center transition-colors", focused ? "text-brand" : "text-slate-400 dark:text-slate-500")}>
          {icon}
        </span>
        {children}
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function AuthForm({ mode, onSwitchMode }: { mode: Mode; onSwitchMode?: (m: Mode) => void }) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; email?: string; password?: string; confirmPassword?: string }>({});
  const [focusedField, setFocusedField] = useState<"username" | "email" | "password" | "confirmPassword" | "referralCode" | null>(null);

  useEffect(() => {
    if (mode !== "register" || typeof window === "undefined") return;
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref?.trim()) setReferralCode(ref.trim().toUpperCase());
  }, [mode]);

  async function onSubmit(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    const parseResult =
      mode === "register"
        ? authRegisterSchema(t).safeParse({ username, email, password, confirmPassword })
        : authLoginSchema(t).safeParse({ username, password });
    const nextErrors: { username?: string; email?: string; password?: string; confirmPassword?: string } = {};
    if (!parseResult.success) {
      for (const issue of parseResult.error.issues) {
        const field = String(issue.path[0] ?? "");
        if (field === "username" || field === "email" || field === "password" || field === "confirmPassword") {
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
        await registerUser(username, email, password, referralCode || undefined);
      } else {
        await loginUser(username, password);
      }
      window.location.href = "/dashboard";
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
    <motion.form
      key={shakeKey}
      className="min-w-0"
      initial={false}
      animate={shakeKey > 0 && (error || Object.keys(fieldErrors).length > 0) ? authShakeKeyframes : undefined}
      onSubmit={(e) => void onSubmit(e)}
      noValidate
    >
      <motion.div className="flex min-w-0 flex-col gap-3.5" variants={staggerContainer.variants} initial={false} animate="visible">
        <motion.div {...staggerItem}>
          <AuthField
            id="auth-username"
            label={t("auth.usernameOrEmail")}
            icon={<User className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />}
            error={fieldErrors.username}
            focused={focusedField === "username"}
            required
          >
            <input
              id="auth-username"
              className="h-11 flex-1 border-0 bg-transparent pe-3 ps-0 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
              placeholder="alexrivera"
              value={username}
              aria-invalid={Boolean(fieldErrors.username)}
              onFocus={() => setFocusedField("username")}
              onBlur={() => setFocusedField(null)}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </AuthField>
        </motion.div>

        {mode === "register" && (
          <motion.div {...staggerItem}>
            <AuthField
              id="auth-email"
              label={t("auth.emailOptional")}
              icon={<Mail className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />}
              error={fieldErrors.email}
              focused={focusedField === "email"}
            >
              <input
                id="auth-email"
                className="h-11 flex-1 border-0 bg-transparent pe-3 ps-0 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder={t("auth.email")}
                value={email}
                aria-invalid={Boolean(fieldErrors.email)}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </AuthField>
          </motion.div>
        )}

        {mode === "register" && (
          <motion.div {...staggerItem}>
            <AuthField
              id="auth-referral"
              label={t("auth.referralOptional")}
              icon={<Gift className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />}
              focused={focusedField === "referralCode"}
            >
              <input
                id="auth-referral"
                className="h-11 flex-1 border-0 bg-transparent pe-3 ps-0 text-sm uppercase text-slate-900 outline-none placeholder:normal-case placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder={t("auth.referralPlaceholder")}
                value={referralCode}
                onFocus={() => setFocusedField("referralCode")}
                onBlur={() => setFocusedField(null)}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                autoComplete="off"
              />
            </AuthField>
          </motion.div>
        )}

        <motion.div {...staggerItem} className={mode === "register" ? "flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:gap-3" : undefined}>
          <div className={mode === "register" ? "min-w-0 sm:flex-1" : undefined}>
            <AuthField
              id="auth-password"
              label={t("auth.password")}
              icon={<Lock className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />}
              error={fieldErrors.password}
              focused={focusedField === "password"}
              required
            >
              <input
                id="auth-password"
                className="h-11 flex-1 border-0 bg-transparent pe-11 ps-0 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                aria-invalid={Boolean(fieldErrors.password)}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
              />
              <button
                type="button"
                className="absolute end-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-black/[0.04] hover:text-slate-600 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
              >
                {showPassword ? <EyeOff className="h-[16px] w-[16px]" strokeWidth={1.75} /> : <Eye className="h-[16px] w-[16px]" strokeWidth={1.75} />}
              </button>
            </AuthField>
          </div>

          {mode === "register" && (
            <div className="min-w-0 sm:flex-1">
              <AuthField
                id="auth-confirm-password"
                label={t("auth.confirmPassword")}
                icon={<Lock className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />}
                error={fieldErrors.confirmPassword || (confirmPassword.length > 0 && password !== confirmPassword ? t("validation.passwordMismatch") : undefined)}
                focused={focusedField === "confirmPassword"}
                required
              >
                <input
                  id="auth-confirm-password"
                  className="h-11 flex-1 border-0 bg-transparent pe-3 ps-0 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  aria-invalid={Boolean(fieldErrors.confirmPassword) || (confirmPassword.length > 0 && password !== confirmPassword)}
                  onFocus={() => setFocusedField("confirmPassword")}
                  onBlur={() => setFocusedField(null)}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </AuthField>
            </div>
          )}
        </motion.div>

        {mode === "login" && (
          <motion.div {...staggerItem} className="flex items-center justify-between text-[13px]">
            <label className="flex cursor-pointer items-center gap-2 text-slate-500 dark:text-slate-400">
              <input
                type="checkbox"
                className="h-4 w-4 cursor-pointer appearance-none rounded border-[1.5px] border-black/15 bg-slate-100 transition-all checked:border-brand checked:bg-brand checked:shadow-[0_0_8px_rgba(34,197,94,0.3)] dark:border-white/15 dark:bg-[#13161d]"
                style={rememberMe ? { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath fill='white' d='M10.2 3.2 4.8 8.6 1.8 5.6l1-1 2 2 4.4-4.4z'/%3E%3C/svg%3E\")", backgroundSize: "10px", backgroundPosition: "center", backgroundRepeat: "no-repeat" } : undefined}
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              {t("auth.rememberMe")}
            </label>
            <button
              type="button"
              className="font-medium text-brand transition-opacity hover:opacity-80"
              onClick={() => showToast(t("auth.forgotPasswordDisabled"), "error")}
            >
              {t("auth.forgotPassword")}
            </button>
          </motion.div>
        )}

        <motion.div {...staggerItem}>
          <button
            type="submit"
            className="flex h-11 w-full items-center justify-center rounded-xl border-0 bg-brand text-sm font-bold tracking-wide text-white shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_8px_28px_-4px_rgba(34,197,94,0.5)] transition-all hover:brightness-110 hover:shadow-[0_1px_0_rgba(255,255,255,0.15)_inset,0_12px_40px_-4px_rgba(34,197,94,0.6)] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={busy || !username || !password || (mode === "register" && !confirmPassword)}
          >
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

        <motion.div {...staggerItem}>
          <AuthSocialButtons />
        </motion.div>

        <motion.p {...staggerItem} className="text-center text-[13px] text-slate-400 dark:text-slate-500">
          {mode === "login" ? (
            <>
              {t("auth.newToStream")}{" "}
              <button type="button" className="font-medium text-brand transition-opacity hover:opacity-80" onClick={() => onSwitchMode?.("register")}>
                {t("auth.signUp")}
              </button>
            </>
          ) : (
            <>
              {t("auth.alreadyHaveAccount")}{" "}
              <button type="button" className="font-medium text-brand transition-opacity hover:opacity-80" onClick={() => onSwitchMode?.("login")}>
                {t("auth.login")}
              </button>
            </>
          )}
        </motion.p>
      </motion.div>
    </motion.form>
  );
}
