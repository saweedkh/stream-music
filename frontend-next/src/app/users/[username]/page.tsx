"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Radio, User } from "lucide-react";
import { useTranslations } from "@/components/providers/locale-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserVerifiedBadge } from "@/components/ui/user-verified-badge";
import { getPublicUserProfile, type PublicUserProfile } from "@/lib/api";

export default function PublicUserProfilePage() {
  const { t } = useTranslations();
  const params = useParams();
  const username = String(params.username ?? "");
  const [data, setData] = useState<PublicUserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    getPublicUserProfile(username)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : t("profile.public.loadFailed")))
      .finally(() => setLoading(false));
  }, [username, t]);

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
            <CardDescription>@{data.user.username}</CardDescription>
            {data.profile.bio ? <p className="mt-3 text-sm text-foreground">{data.profile.bio}</p> : null}
          </div>
        </CardHeader>
        {data.is_self ? (
          <CardContent>
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard?tab=settings">{t("profile.public.editInSettings")}</Link>
            </Button>
          </CardContent>
        ) : null}
      </Card>

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
    </div>
  );
}
