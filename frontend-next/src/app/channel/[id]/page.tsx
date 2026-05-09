import { AuthGuard } from "@/features/auth/auth-guard";
import { ChannelDashboardTabs } from "@/features/channels/channel-dashboard-tabs";
import { getChannelState } from "@/lib/api";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ChannelPage({ params }: Props) {
  const { id } = await params;
  const data = await getChannelState(id).catch(() => null);
  const startedAt = data?.playback?.started_at_server_time;
  const pausedAt = data?.playback?.paused_at_position;
  const trackPath = data?.playback?.track?.file ?? undefined;
  const isPlaying = data?.playback?.is_playing ?? false;

  return (
    <AuthGuard>
      <ChannelDashboardTabs
        channelId={id}
        channelOwnerId={data?.channel?.owner}
        channelName={data?.channel?.name ?? `Channel #${id}`}
        channelPrivacy={data?.channel?.privacy ?? "unknown"}
        isPlaying={isPlaying}
        trackPath={trackPath}
        startedAt={startedAt ?? undefined}
        pausedAt={pausedAt ?? undefined}
        initialDescription={data?.channel?.description}
        initialMemberLimit={data?.channel?.member_limit ?? 50}
        publicSlug={data?.channel?.public_slug}
        initialJoinRequiresApproval={Boolean(data?.channel?.join_requires_approval)}
      />
    </AuthGuard>
  );
}
