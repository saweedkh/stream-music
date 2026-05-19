"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
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
import { useTranslations } from "@/components/providers/locale-provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { reopenChannel, type ChannelSummary } from "@/lib/api";
import { useToast } from "@/components/ui/toast-provider";
import { filterDashboardChannels, sortChannelsForDashboard } from "@/lib/channel-filters";
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

  const [createOpen, setCreateOpen] = useState(false);

  const visibleChannels = useMemo(
    () => sortChannelsForDashboard(filterDashboardChannels(channels)),
    [channels],
  );

  const liveCount = useMemo(
    () => visibleChannels.filter((c) => c.is_active !== false && c.is_playing === true).length,
    [visibleChannels],
  );

  return (
    <div className="flex flex-1 flex-col gap-4 md:gap-5 max-lg:overflow-visible xl:grid xl:grid-cols-[minmax(0,1fr)_min(100%,20rem)] xl:items-start">
      {/* Create — first on mobile, sidebar on xl */}
      <aside className="order-1 shrink-0 xl:order-2 xl:sticky xl:top-0">
        <div className="xl:hidden">
          <Button
            type="button"
            variant="outline"
            className="mb-3 flex h-11 w-full items-center justify-between gap-2 border-border/70 bg-card/60 px-4"
            aria-expanded={createOpen}
            onClick={() => setCreateOpen((v) => !v)}
          >
            <span className="flex items-center gap-2 font-medium">
              <Plus className="h-4 w-4 text-brand" aria-hidden />
              {t("channels.newChannel")}
            </span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", createOpen && "rotate-180")} />
          </Button>
        </div>
        <div className={cn("xl:block", createOpen ? "block" : "hidden")}>
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
        </div>
      </aside>

      {/* Channel list */}
      <section className="order-2 flex min-w-0 flex-1 flex-col max-lg:overflow-visible max-lg:rounded-none max-lg:border-0 max-lg:bg-transparent xl:order-1 xl:min-h-0 xl:overflow-hidden xl:rounded-xl xl:border xl:border-border/50 xl:bg-card/30">
        <header className="flex shrink-0 flex-col gap-3 border-b border-border/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3.5">
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold tracking-tight sm:text-lg">{t("channels.yourChannels")}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              {visibleChannels.length > 0
                ? t("channels.roomsSummary", { total: visibleChannels.length, live: liveCount })
                : t("channels.createSubtitle")}
            </p>
          </div>
          {liveCount > 0 ? (
            <Badge variant="success" className="w-fit shrink-0 gap-1.5 self-start sm:self-center">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              {t("channels.liveNow", { count: liveCount })}
            </Badge>
          ) : null}
        </header>

        <div className="flex-1 max-lg:overflow-visible xl:min-h-0 xl:overflow-y-auto xl:overscroll-y-contain">
          <div className="p-3 sm:p-4">
            {visibleChannels.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/10 px-4 py-12 text-center sm:py-16">
                <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-border/50 bg-card/80 text-muted-foreground">
                  <Radio className="h-6 w-6 opacity-60" aria-hidden />
                </span>
                <p className="max-w-sm text-sm text-muted-foreground">{t("channels.empty")}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-4 xl:hidden"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {t("channels.newChannel")}
                </Button>
              </div>
            ) : (
              <ul className="grid gap-2 sm:gap-3">
                {visibleChannels.map((channel) => (
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
        </div>
      </section>
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
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50">
      <div className="border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <Plus className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold sm:text-base">{t("channels.newChannel")}</h3>
            <p className="text-xs text-muted-foreground">{t("channels.createSubtitle")}</p>
          </div>
        </div>
      </div>

      <form
        className="space-y-4 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onCreateChannel();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="dash-new-channel-name">{t("channels.name")}</Label>
          <Input
            id="dash-new-channel-name"
            value={channelName}
            aria-invalid={Boolean(errors.channelName)}
            valid={Boolean(channelName.trim())}
            onChange={(e) => onChannelNameChange(e.target.value)}
            placeholder={t("channels.namePlaceholder")}
          />
          {errors.channelName ? <p className="text-xs text-rose-400">{errors.channelName}</p> : null}
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">{t("channels.privacy")}</legend>
          <div
            className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden"
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
                    "flex min-w-[5.5rem] shrink-0 flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center text-[10px] font-medium transition-colors sm:min-w-0 sm:text-[11px]",
                    selected
                      ? "border-brand/40 bg-brand/10 text-brand"
                      : "border-border/60 bg-background/60 text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                  aria-pressed={selected}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
                  <span className="leading-tight">{t(PRIVACY_KEYS[value])}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="space-y-1.5">
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
          />
          {errors.memberLimit ? <p className="text-xs text-rose-400">{errors.memberLimit}</p> : null}
        </div>

        <Button type="submit" className="h-11 w-full gap-2 bg-brand text-brand-foreground hover:bg-brand-strong">
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

  const statusBadge = !isActive ? (
    <Badge variant="warning" className="shrink-0 text-[10px]">
      {t("channels.closed")}
    </Badge>
  ) : isLive ? (
    <Badge variant="success" className="shrink-0 gap-1 text-[10px]">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {t("channels.live")}
    </Badge>
  ) : (
    <Badge variant="secondary" className="shrink-0 text-[10px]">
      {t("channels.notPlaying")}
    </Badge>
  );

  return (
    <article
      className={cn(
        "rounded-xl border p-3 transition-colors sm:p-4",
        isLive ? "border-brand/30 bg-brand/[0.04]" : "border-border/50 bg-background/40 hover:border-border hover:bg-muted/20",
        !isActive && "opacity-95",
      )}
    >
      <div className="flex gap-3">
        <span
          className={cn(
            "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border sm:h-12 sm:w-12",
            isLive ? "border-brand/25 bg-brand/10 text-brand" : "border-border/50 bg-muted/30 text-muted-foreground",
          )}
        >
          <Radio className="h-5 w-5" aria-hidden />
          {isLive ? (
            <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" aria-hidden />
          ) : null}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate text-sm font-semibold text-foreground sm:text-base">{channel.name}</h3>
            {statusBadge}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground sm:text-xs">
            <span>{t(PRIVACY_KEYS[channel.privacy] ?? "channels.privacyPublic")}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-0.5">
              <Users className="h-3 w-3" aria-hidden />
              {t("channels.cap", { count: channel.member_limit ?? "—" })}
            </span>
          </p>

          {(channel.membership_is_active === false || channel.join_requires_approval) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
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
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:justify-end">
        {!isActive && !isOwner ? (
          <Button variant="secondary" className="h-10 w-full sm:w-auto sm:min-w-[8.5rem]" disabled type="button">
            {t("channels.closed")}
          </Button>
        ) : (
          <Button
            variant={isLive ? "default" : "secondary"}
            className={cn("h-10 w-full gap-1.5 sm:w-auto sm:min-w-[8.5rem]", isLive && "bg-brand text-brand-foreground hover:bg-brand-strong")}
            asChild
          >
            <Link href={`/channel/${channel.id}`}>
              {primaryLabel}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </Link>
          </Button>
        )}
        {!isActive && isOwner ? (
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full sm:w-auto sm:min-w-[8.5rem]"
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
