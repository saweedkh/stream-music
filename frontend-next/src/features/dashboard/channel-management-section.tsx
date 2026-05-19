"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  Globe,
  Lock,
  Plus,
  Radio,
  Sparkles,
  EyeOff,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslations } from "@/components/providers/locale-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { reopenChannel, type ChannelSummary } from "@/lib/api";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";

type Props = {
  channels: ChannelSummary[];
  channelName: string;
  channelPrivacy: ChannelSummary["privacy"];
  memberLimit: string;
  errors: { channelName?: string; memberLimit?: string };
  onChannelNameChange: (value: string) => void;
  onChannelPrivacyChange: (value: ChannelSummary["privacy"]) => void;
  onMemberLimitChange: (value: string) => void;
  onCreateChannel: () => void;
  currentUserId: number | null;
  onChannelsRefresh: () => void | Promise<void>;
};

const PRIVACY_KEYS: Record<ChannelSummary["privacy"], MessageKey> = {
  public: "channels.privacyPublic",
  private: "channels.privacyPrivate",
  unlisted: "channels.privacyUnlisted",
};

const PRIVACY_OPTIONS: Array<{
  value: ChannelSummary["privacy"];
  icon: typeof Globe;
}> = [
  { value: "public", icon: Globe },
  { value: "private", icon: Lock },
  { value: "unlisted", icon: EyeOff },
];

export function ChannelManagementSection(props: Props) {
  const { t } = useTranslations();
  const {
    channels,
    channelName,
    channelPrivacy,
    memberLimit,
    errors,
    onChannelNameChange,
    onChannelPrivacyChange,
    onMemberLimitChange,
    onCreateChannel,
    currentUserId,
    onChannelsRefresh,
  } = props;

  const liveCount = useMemo(
    () => channels.filter((c) => c.is_active !== false && c.is_playing === true).length,
    [channels],
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_min(100%,22rem)]">
      <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 shadow-sm">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border/50 bg-muted/10 px-5 py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand">
                <Radio className="h-4 w-4" aria-hidden />
              </span>
              <h2 className="font-display text-lg font-semibold tracking-tight">{t("channels.yourChannels")}</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              {channels.length > 0
                ? t("channels.roomsSummary", { total: channels.length, live: liveCount })
                : t("channels.createSubtitle")}
            </p>
          </div>
          {liveCount > 0 ? (
            <Badge variant="success" className="gap-1.5 px-2.5 py-1">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {t("channels.liveNow", { count: liveCount })}
            </Badge>
          ) : null}
        </header>

        <ScrollArea className="max-h-[min(32rem,100%)]">
          <div className="p-4 sm:p-5">
            {channels.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 px-6 py-10 text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-card/80 text-muted-foreground">
                  <Radio className="h-7 w-7 opacity-60" aria-hidden />
                </span>
                <p className="max-w-xs text-sm text-muted-foreground">{t("channels.empty")}</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {channels.map((channel) => (
                  <li key={channel.id}>
                    <ChannelCard
                      channel={channel}
                      currentUserId={currentUserId}
                      onChannelsRefresh={onChannelsRefresh}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ScrollArea>
      </section>

      <aside className="xl:sticky xl:top-4 xl:self-start">
        <CreateChannelPanel
          channelName={channelName}
          channelPrivacy={channelPrivacy}
          memberLimit={memberLimit}
          errors={errors}
          onChannelNameChange={onChannelNameChange}
          onChannelPrivacyChange={onChannelPrivacyChange}
          onMemberLimitChange={onMemberLimitChange}
          onCreateChannel={onCreateChannel}
        />
      </aside>
    </div>
  );
}

function CreateChannelPanel({
  channelName,
  channelPrivacy,
  memberLimit,
  errors,
  onChannelNameChange,
  onChannelPrivacyChange,
  onMemberLimitChange,
  onCreateChannel,
}: {
  channelName: string;
  channelPrivacy: ChannelSummary["privacy"];
  memberLimit: string;
  errors: { channelName?: string; memberLimit?: string };
  onChannelNameChange: (value: string) => void;
  onChannelPrivacyChange: (value: ChannelSummary["privacy"]) => void;
  onMemberLimitChange: (value: string) => void;
  onCreateChannel: () => void;
}) {
  const { t } = useTranslations();

  return (
    <div className="overflow-hidden rounded-2xl border border-brand/25 bg-gradient-to-br from-brand/[0.08] via-card/80 to-card/40 shadow-lg shadow-brand/5">
      <div className="border-b border-brand/15 bg-brand/[0.06] px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-md shadow-brand/25">
            <Plus className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h3 className="font-display text-base font-semibold">{t("channels.newChannel")}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t("channels.createSubtitle")}</p>
          </div>
        </div>
      </div>

      <form
        className="space-y-5 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          onCreateChannel();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="dash-new-channel-name">{t("channels.name")}</Label>
          <Input
            id="dash-new-channel-name"
            value={channelName}
            aria-invalid={Boolean(errors.channelName)}
            valid={Boolean(channelName.trim())}
            onChange={(e) => onChannelNameChange(e.target.value)}
            placeholder={t("channels.namePlaceholder")}
            className="bg-background/80"
          />
          {errors.channelName ? <p className="text-xs text-rose-400">{errors.channelName}</p> : null}
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium leading-none">{t("channels.privacy")}</legend>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("channels.privacy")}>
            {PRIVACY_OPTIONS.map(({ value, icon: Icon }) => {
              const selected = channelPrivacy === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChannelPrivacyChange(value)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-center text-[11px] font-medium transition-all",
                    selected
                      ? "border-brand/50 bg-brand/15 text-brand shadow-sm shadow-brand/10"
                      : "border-border/70 bg-background/50 text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground",
                  )}
                  aria-pressed={selected}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span className="leading-tight">{t(PRIVACY_KEYS[value])}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="dash-new-channel-limit" className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            {t("channels.memberLimit")}
          </Label>
          <Input
            id="dash-new-channel-limit"
            type="number"
            inputMode="numeric"
            min={1}
            value={memberLimit}
            aria-invalid={Boolean(errors.memberLimit)}
            valid={Boolean(memberLimit.trim() && Number(memberLimit) > 0)}
            onChange={(e) => onMemberLimitChange(e.target.value)}
            className="bg-background/80"
          />
          {errors.memberLimit ? <p className="text-xs text-rose-400">{errors.memberLimit}</p> : null}
        </div>

        <Button type="submit" className="w-full gap-2 bg-brand text-brand-foreground shadow-md shadow-brand/20 hover:bg-brand-strong">
          <Sparkles className="h-4 w-4" aria-hidden />
          {t("channels.create")}
        </Button>
      </form>
    </div>
  );
}

function ChannelCard({
  channel,
  currentUserId,
  onChannelsRefresh,
}: {
  channel: ChannelSummary;
  currentUserId: number | null;
  onChannelsRefresh: () => void | Promise<void>;
}) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const isOwner = channel.owner != null && currentUserId != null && Number(channel.owner) === Number(currentUserId);
  const isActive = channel.is_active !== false;
  const isPlaying = channel.is_playing === true;
  const isLive = isActive && isPlaying;
  const primaryLabel =
    !isActive && isOwner
      ? t("channels.manage")
      : channel.membership_is_active === false
        ? t("channels.reconnect")
        : t("channels.openRoom");

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-4 overflow-hidden rounded-xl border p-4 transition-all duration-300 sm:flex-row sm:items-center",
        isLive
          ? "border-brand/35 bg-gradient-to-r from-brand/[0.07] via-card/50 to-card/30 shadow-sm shadow-brand/10"
          : "border-border/60 bg-card/30 hover:border-border hover:bg-card/50 hover:shadow-md hover:shadow-black/5",
        !isActive && "opacity-90",
      )}
    >
      {isLive ? (
        <div
          className="pointer-events-none absolute inset-y-0 start-0 w-1 bg-gradient-to-b from-brand via-brand-muted to-transparent"
          aria-hidden
        />
      ) : null}

      <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
        <span
          className={cn(
            "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-colors",
            isLive
              ? "border-brand/30 bg-brand/15 text-brand"
              : "border-border/60 bg-muted/30 text-muted-foreground group-hover:text-foreground",
          )}
        >
          <Radio className="h-5 w-5" aria-hidden />
          {isLive ? (
            <span className="absolute -end-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
            </span>
          ) : null}
        </span>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-medium text-foreground">{channel.name}</h3>
            {!isActive ? (
              <Badge variant="warning" className="text-[10px]">
                {t("channels.closed")}
              </Badge>
            ) : isLive ? (
              <Badge variant="success" className="gap-1 text-[10px]">
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {t("channels.live")}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">
                {t("channels.notPlaying")}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{t(PRIVACY_KEYS[channel.privacy] ?? "channels.privacyPublic")}</span>
            <span className="hidden text-border sm:inline" aria-hidden>
              ·
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden />
              {t("channels.cap", { count: channel.member_limit ?? "—" })}
            </span>
            {channel.membership_is_active === false ? (
              <Badge variant="outline" className="text-[10px] font-normal">
                {t("channels.leftReconnect")}
              </Badge>
            ) : null}
            {channel.join_requires_approval ? (
              <Badge variant="warning" className="text-[10px] font-normal">
                {t("channels.approvalRequired")}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:w-36">
        {!isActive && !isOwner ? (
          <Button variant="secondary" className="w-full" disabled type="button">
            {t("channels.closed")}
          </Button>
        ) : (
          <Button
            variant={isLive ? "default" : "secondary"}
            className={cn("w-full gap-1.5", isLive && "bg-brand text-brand-foreground hover:bg-brand-strong")}
            asChild
          >
            <Link href={`/channel/${channel.id}`}>
              {primaryLabel}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
            </Link>
          </Button>
        )}
        {!isActive && isOwner ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              void (async () => {
                try {
                  await reopenChannel(String(channel.id));
                  showToast(t("channels.reopenSuccess"), "success");
                  await onChannelsRefresh();
                } catch (e) {
                  showToast(e instanceof Error ? e.message : t("channels.reopenFailed"), "error");
                }
              })();
            }}
          >
            {t("channels.reopen")}
          </Button>
        ) : null}
      </div>
    </article>
  );
}
