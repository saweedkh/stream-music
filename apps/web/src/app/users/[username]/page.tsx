"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ListMusic, Radio, User, UserPlus, UserMinus } from "lucide-react";
import { useTranslations } from "@/shared/providers/locale-provider";
import { UserAvatar } from "@/shared/ui/user-avatar";
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
          <UserAvatar
            username={data.user.username}
            displayName={displayName}
            avatarUrl={data.profile.avatar_url ?? data.user.avatar_url}
            className="h-14 w-14"
            fallbackClassName="bg-gradient-to-br from-brand/30 to-brand/5 text-lg"
          />
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
              <Link href="/dashboard?tab=profile">{t("profile.public.editInSettings")}</Link>
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
