"use client";

import { Globe, Lock, EyeOff, Plus, Users } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useTranslations } from "@/shared/providers/locale-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import type { ChannelSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

const PRIVACY_KEYS: Record<ChannelSummary["privacy"], MessageKey> = {
  public: "channels.privacyPublic",
  private: "channels.privacyPrivate",
  unlisted: "channels.privacyUnlisted",
};

const PRIVACY_OPTIONS: Array<{ value: ChannelSummary["privacy"]; icon: typeof Globe }> = [
  { value: "public", icon: Globe },
  { value: "private", icon: Lock },
  { value: "unlisted", icon: EyeOff },
];

export type CreateChannelFormProps = {
  channelName: string;
  channelPrivacy: ChannelSummary["privacy"];
  memberLimit: string;
  errors: { channelName?: string; memberLimit?: string };
  onChannelNameChange: (value: string) => void;
  onChannelPrivacyChange: (value: ChannelSummary["privacy"]) => void;
  onMemberLimitChange: (value: string) => void;
  onCreateChannel: () => void;
  idPrefix?: string;
  /** Narrow desktop rail — compact segmented privacy */
  layout?: "default" | "rail";
};

export function CreateChannelForm({
  channelName,
  channelPrivacy,
  memberLimit,
  errors,
  onChannelNameChange,
  onChannelPrivacyChange,
  onMemberLimitChange,
  onCreateChannel,
  idPrefix = "dash",
  layout = "default",
}: CreateChannelFormProps) {
  const { t } = useTranslations();
  const rail = layout === "rail";

  return (
    <form
      className={cn("flex flex-col", rail ? "gap-5" : "gap-4")}
      onSubmit={(e) => {
        e.preventDefault();
        onCreateChannel();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-new-channel-name`} className={rail ? "text-xs text-muted-foreground" : undefined}>
          {t("channels.name")}
        </Label>
        <Input
          id={`${idPrefix}-new-channel-name`}
          value={channelName}
          aria-invalid={Boolean(errors.channelName)}
          valid={Boolean(channelName.trim())}
          onChange={(e) => onChannelNameChange(e.target.value)}
          placeholder={t("channels.namePlaceholder")}
          className={rail ? "h-10" : "h-11"}
        />
        {errors.channelName ? <p className="text-xs text-rose-500 dark:text-rose-400">{errors.channelName}</p> : null}
      </div>

      <fieldset className="space-y-2">
        <legend className={cn("text-sm font-medium", rail && "text-xs font-medium text-muted-foreground")}>
          {t("channels.privacy")}
        </legend>
        {rail ? (
          <div
            className="flex flex-col gap-1 rounded-lg border border-[var(--workspace-divider)] bg-muted/25 p-1"
            role="group"
            aria-label={t("channels.privacy")}
          >
            {PRIVACY_OPTIONS.map(({ value, icon: Icon }) => {
              const selected = channelPrivacy === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChannelPrivacyChange(value)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-start text-sm transition-colors",
                    selected
                      ? "bg-background font-medium text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                  )}
                  aria-pressed={selected}
                >
                  <Icon className={cn("size-4 shrink-0", selected && "text-brand")} aria-hidden />
                  {t(PRIVACY_KEYS[value])}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("channels.privacy")}>
            {PRIVACY_OPTIONS.map(({ value, icon: Icon }) => {
              const selected = channelPrivacy === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChannelPrivacyChange(value)}
                  className={cn(
                    "flex min-h-[4.25rem] flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-center text-[11px] font-medium transition-colors sm:text-xs",
                    selected
                      ? "bg-brand/15 text-brand ring-2 ring-brand/35"
                      : "bg-[var(--workspace-stat)] text-muted-foreground hover:bg-muted/45 hover:text-foreground",
                  )}
                  aria-pressed={selected}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="leading-tight">{t(PRIVACY_KEYS[value])}</span>
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-new-channel-limit`} className={cn("flex items-center gap-1.5", rail && "text-xs text-muted-foreground")}>
          <Users className="size-3.5 opacity-70" aria-hidden />
          {t("channels.memberLimit")}
        </Label>
        <Input
          id={`${idPrefix}-new-channel-limit`}
          type="number"
          inputMode="numeric"
          min={1}
          value={memberLimit}
          aria-invalid={Boolean(errors.memberLimit)}
          valid={Boolean(memberLimit.trim() && Number(memberLimit) > 0)}
          onChange={(e) => onMemberLimitChange(e.target.value)}
          className={rail ? "h-10" : "h-11"}
        />
        {errors.memberLimit ? <p className="text-xs text-rose-500 dark:text-rose-400">{errors.memberLimit}</p> : null}
      </div>

      <Button
        type="submit"
        className={cn(
          "w-full gap-2 bg-brand text-brand-foreground hover:bg-brand-strong",
          rail ? "h-10 rounded-lg" : "h-11",
        )}
      >
        <Plus className="size-4" aria-hidden />
        {t("channels.create")}
      </Button>
    </form>
  );
}
