"use client";

import { motion } from "framer-motion";
import { useTranslations } from "@/components/providers/locale-provider";
import { useToast } from "@/components/ui/toast-provider";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.5-5.1 3.5-3.1 0-5.6-2.5-5.6-5.6S8.9 6.1 12 6.1c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.8 3.6 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12S6.8 21.5 12 21.5c6.9 0 8.6-4.8 8.6-7.3 0-.5 0-.9-.1-1.2H12z" />
      <path fill="#34A853" d="M2.5 7.5l3 2.3C6.4 7.8 8.9 6.1 12 6.1c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.8 3.6 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12c0 1.1.3 2.1.7 3l-3.2-2.5z" />
      <path fill="#4285F4" d="M12 21.5c3.3 0 6.1-1.1 8.1-3l-3.7-3c-1 .7-2.3 1.2-4.4 1.2-3.4 0-6.2-2.3-7.2-5.4l-3 2.3C4.9 19.1 8.1 21.5 12 21.5z" />
      <path fill="#FBBC05" d="M21.1 12.3c0-.8-.1-1.4-.2-2H12v3.8h5.1c-.2 1-1 2.5-2.6 3.5l3.7 3c2.2-2 3.5-5 3.5-8.3z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden>
      <path d="M16.7 13.2c-.1-2.2 1.8-3.3 1.9-3.4-1-.1-2-.6-2.6-1.5-.6-.9-1-2.3-.4-3.6.7-1.2 2-1.9 3.1-1.9.6 0 2.2.1 3.3 1.6-2.8 1.5-2.3 5.4.5 6.6-.5 1.5-1.5 3-2.7 3-.5 0-1-.3-1.6-.3-.6 0-1.2.3-1.8.3-1.1 0-2.3-1.5-2.7-2.9ZM14.2 4.5c.5-.6.9-1.5.8-2.4-.8 0-1.7.5-2.2 1.1-.5.6-.9 1.5-.8 2.4.9.1 1.8-.5 2.2-1.1Z" />
    </svg>
  );
}

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#1DB954" />
      <path
        fill="#fff"
        d="M17.3 11.2c-2.5-1.5-6.6-1.6-9-.9-.4.1-.8-.1-.9-.5s.1-.8.5-.9c2.8-.8 7.4-.7 10.2 1.1.3.2.4.7.2 1-.2.3-.7.4-1 .2zm-.2 2.4c-.2.3-.6.4-.9.2-2-1.2-5.2-1.6-7.6-.9-.3.1-.7-.1-.8-.4s.1-.7.4-.8c2.8-.8 6.4-.4 8.8 1 .3.2.4.6.1.9zm-1 2.3c-.2.2-.5.3-.7.1-1.7-1-4.5-1.3-6.6-.7-.2.1-.5 0-.6-.2s0-.5.2-.6c2.4-.7 5.5-.4 7.6.9.2.1.3.5.1.7z"
      />
    </svg>
  );
}

const PROVIDERS = [
  { id: "spotify", labelKey: "auth.social.spotify" as const, Icon: SpotifyIcon },
  { id: "apple", labelKey: "auth.social.apple" as const, Icon: AppleIcon },
  { id: "google", labelKey: "auth.social.google" as const, Icon: GoogleIcon },
] as const;

export function AuthSocialButtons() {
  const { t } = useTranslations();
  const { showToast } = useToast();

  return (
    <div className="auth-social-block">
      <div className="auth-or-row">
        <span className="auth-or-line" aria-hidden />
        <span className="auth-or-text">{t("auth.orDivider")}</span>
        <span className="auth-or-line" aria-hidden />
      </div>
      <div className="auth-social-row">
        {PROVIDERS.map((provider) => {
          const Icon = provider.Icon;
          return (
            <motion.button
              key={provider.id}
              type="button"
              className="auth-social-btn"
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => showToast(t("auth.socialDisabled"), "error")}
              aria-label={t(provider.labelKey)}
            >
              <Icon />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
