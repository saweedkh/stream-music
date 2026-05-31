"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ListMusic, PartyPopper, Radio, Sparkles, User, UserPlus, UserMinus } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { UserVerifiedBadge } from "@/shared/ui/user-verified-badge";
import { useToast } from "@/shared/ui/toast-provider";
import {
  followUser,
  getPublicUserProfile,
  getUserFollow,
  unfollowUser,
  type PublicUserProfile,
} from "@/lib/api";

export default function PublicUserProfilePage() {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const params = useParams();
  const username = String(params.username ?? "");
  const [data, setData] = useState<PublicUserProfile | null>(null);
  const [userFollowing, setUserFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    Promise.all([getPublicUserProfile(username), getUserFollow(username).catch(() => null)])
      .then(([profile, follow]) => {
        setData(profile);
        if (follow) {
          setUserFollowing(follow.following);
          setFollowerCount(follow.follower_count);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : t("profile.public.loadFailed")))
      .finally(() => setLoading(false));
  }, [username, t]);

  async function toggleFollow() {
    if (!data || data.is_self) return;
    setFollowBusy(true);
    try {
      if (userFollowing) {
        await unfollowUser(username);
        setUserFollowing(false);
        setFollowerCount((c) => Math.max(0, c - 1));
        showToast(t("profile.public.unfollow"), "success");
      } else {
        await followUser(username);
        setUserFollowing(true);
        setFollowerCount((c) => c + 1);
        showToast(t("profile.public.follow"), "success");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setFollowBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <p className="text-sm text-muted-foreground">{error ?? t("profile.public.notFound")}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/dashboard">{t("nav.dashboard")}</Link>
        </Button>
      </div>
    );
  }

  const displayName =
    [data.user.first_name, data.user.last_name].filter(Boolean).join(" ").trim() || data.user.username;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <Card>
        <CardHeader className="flex flex-row items-start gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <User className="h-5 w-5 text-muted-foreground" />
              {displayName}
              <UserVerifiedBadge flags={{ badges: data.user.badges }} />
            </CardTitle>
            <CardDescription>
              @{data.user.username} · {t("profile.public.followers", { count: followerCount })}
            </CardDescription>
            {data.profile.bio ? <p className="mt-3 text-sm text-foreground">{data.profile.bio}</p> : null}
          </div>
          {!data.is_self ? (
            <Button type="button" size="sm" variant={userFollowing ? "outline" : "default"} disabled={followBusy} onClick={() => void toggleFollow()}>
              {userFollowing ? <UserMinus className="mr-1 h-4 w-4" /> : <UserPlus className="mr-1 h-4 w-4" />}
              {userFollowing ? t("profile.public.unfollow") : t("profile.public.follow")}
            </Button>
          ) : null}
        </CardHeader>
        {data.is_self ? (
          <CardContent>
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard?tab=settings">{t("profile.public.editInSettings")}</Link>
            </Button>
          </CardContent>
        ) : null}
      </Card>

      {data.stats ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("profile.public.stats")}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">{t("profile.public.sessionsJoined")}</p>
              <p className="text-lg font-semibold">{data.stats.sessions_joined}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("profile.public.tracksPlayed")}</p>
              <p className="text-lg font-semibold">{data.stats.tracks_played}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {data.gamification ? (
        <Card data-testid="public-profile-gamification">
          <CardHeader>
            <CardTitle className="text-base">{t("profile.public.gamification")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">
              {t("profile.public.gamificationSummary", {
                level: data.gamification.level,
                points: data.gamification.points,
                streak: data.gamification.streak_days,
              })}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {(data.live_channels?.length ?? 0) > 0 ? (
        <section data-testid="public-profile-live-channels">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Radio className="h-4 w-4 text-brand" />
            {t("profile.public.liveNow")}
          </h2>
          <ul className="space-y-2">
            {data.live_channels!.map((ch) => (
              <li key={ch.id}>
                <Link
                  href={`/channel/${ch.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3"
                >
                  <span className="font-medium">{ch.name}</span>
                  <Badge className="bg-brand text-primary-foreground">{t("profile.public.liveBadge")}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(data.party_highlights?.length ?? 0) > 0 ? (
        <section data-testid="public-profile-party-highlights">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <PartyPopper className="h-4 w-4" />
            {t("profile.public.partyHighlights")}
          </h2>
          <ul className="space-y-3">
            {data.party_highlights!.map((h) => (
              <li key={h.channel_id} className="rounded-xl border border-border/70 bg-card px-4 py-3">
                <Link href={`/party/${h.channel_id}`} className="font-medium text-brand hover:underline">
                  {h.channel_name}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("profile.public.partyEvents", { count: h.total_events })}
                </p>
                {h.top_tracks.length > 0 ? (
                  <ol className="mt-2 list-decimal ps-4 text-sm text-foreground/90">
                    {h.top_tracks.map((tr) => (
                      <li key={tr.id}>
                        {tr.title}
                        {tr.artist ? ` — ${tr.artist}` : ""}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {(data.recent_activity?.length ?? 0) > 0 ? (
        <section data-testid="public-profile-activity">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            {t("profile.public.recentActivity")}
          </h2>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {data.recent_activity!.map((ev, i) => (
              <li key={`${ev.kind}-${ev.created_at}-${i}`}>
                {ev.channel_name ? (
                  <Link href={ev.channel_id ? `/channel/${ev.channel_id}` : "#"} className="text-foreground hover:underline">
                    {ev.channel_name}
                  </Link>
                ) : (
                  "—"
                )}{" "}
                · {ev.kind.replace(/_/g, " ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("profile.public.channels")}
        </h2>
        {data.public_channels.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("profile.public.noChannels")}</p>
        ) : (
          <ul className="space-y-2">
            {data.public_channels.map((ch) => (
              <li key={ch.id}>
                <Link
                  href={`/channel/${ch.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-card px-4 py-3 transition hover:border-brand/30"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Radio className="h-4 w-4 text-brand" />
                    {ch.name}
                  </span>
                  <Badge variant="outline">{t("profile.public.openRoom")}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(data.public_playlists?.length ?? 0) > 0 ? (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <ListMusic className="h-4 w-4" />
            {t("profile.public.playlists")}
          </h2>
          <ul className="space-y-2">
            {data.public_playlists!.map((pl) => (
              <li key={pl.id} className="rounded-xl border border-border/70 bg-card px-4 py-3 text-sm font-medium">
                {pl.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
