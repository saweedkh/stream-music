"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw, Users } from "lucide-react";
import { useChannelPresence } from "@/hooks/use-channel-presence";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast-provider";
import { getChannelMembers, type ChannelMember } from "@/lib/api";
import { cn } from "@/lib/utils";

type Props = {
  channelId: string;
  onPreviewListenerView?: () => void;
};

function roleBadgeVariant(role: ChannelMember["role"]): "default" | "success" | "secondary" {
  if (role === "owner") return "success";
  if (role === "moderator") return "default";
  return "secondary";
}

export function ChannelListenersPanel({ channelId, onPreviewListenerView }: Props) {
  const { showToast } = useToast();
  const { onlineMembers, onlineCount, onlineIds } = useChannelPresence(channelId);
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getChannelMembers(channelId);
      setMembers(data.results);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Cannot load members.", "error");
    } finally {
      setLoading(false);
    }
  }, [channelId, showToast]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const activeMembers = useMemo(() => members.filter((m) => m.is_active), [members]);
  const inactiveMembers = useMemo(() => members.filter((m) => !m.is_active), [members]);

  return (
    <div className="space-y-4">
      <Card className="border-zinc-800/90">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 border-b border-zinc-800/80 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-brand" aria-hidden />
            Listeners &amp; members
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={() => void loadMembers()}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            {onPreviewListenerView ? (
              <Button type="button" size="sm" className="gap-1.5" onClick={onPreviewListenerView}>
                <Eye className="h-3.5 w-3.5" />
                Preview listener UI
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-zinc-200">Online now</h3>
              <Badge variant="success">{onlineCount} connected</Badge>
            </div>
            {onlineMembers.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-800/80 bg-zinc-950/40 px-4 py-6 text-center text-sm text-zinc-500">
                No one is pinging presence yet — listeners appear when the room socket is connected.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {onlineMembers.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-950/30 py-1 pl-1 pr-3"
                  >
                    <Avatar className="h-8 w-8 border border-emerald-500/40">
                      <AvatarFallback className="text-xs">{(m.username || "?").slice(0, 1)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-zinc-100">@{m.username}</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-400" title="Online" />
                  </div>
                ))}
              </div>
            )}
          </section>

          <Separator />

          <section>
            <h3 className="mb-3 text-sm font-medium text-zinc-200">Room roster ({activeMembers.length} active)</h3>
            {loading ? (
              <ListSkeleton rows={5} />
            ) : activeMembers.length === 0 && inactiveMembers.length === 0 ? (
              <EmptyState title="No members yet" description="Share the join link so listeners can enter the room." />
            ) : (
              <ScrollArea className="h-[min(320px,40vh)]">
                <ul className="space-y-2 pr-3">
                  {activeMembers.map((member) => {
                    const isOnline = onlineIds.has(member.user_id);
                    return (
                      <li
                        key={member.id}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                          isOnline ? "border-emerald-500/20 bg-emerald-950/15" : "border-zinc-800/80 bg-zinc-950/40",
                        )}
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>{(member.username || "?").slice(0, 1)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-100">@{member.username}</p>
                          <p className="text-xs text-zinc-500">
                            Joined {new Date(member.joined_at).toLocaleDateString()}
                            {isOnline ? " · Online" : " · Offline"}
                          </p>
                        </div>
                        <Badge variant={roleBadgeVariant(member.role)} className="capitalize shrink-0">
                          {member.role}
                        </Badge>
                      </li>
                    );
                  })}
                  {inactiveMembers.length > 0 ? (
                    <>
                      <li className="pt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Left room</li>
                      {inactiveMembers.map((member) => (
                        <li
                          key={member.id}
                          className="flex items-center gap-3 rounded-xl border border-zinc-800/60 bg-zinc-950/25 px-3 py-2.5 opacity-70"
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>{(member.username || "?").slice(0, 1)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-zinc-400">@{member.username}</p>
                            <p className="text-xs text-zinc-600">Inactive membership</p>
                          </div>
                          <Badge variant="outline" className="capitalize shrink-0">
                            {member.role}
                          </Badge>
                        </li>
                      ))}
                    </>
                  ) : null}
                </ul>
              </ScrollArea>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
