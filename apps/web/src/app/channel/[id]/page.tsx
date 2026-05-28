import { headers } from "next/headers";
import { AuthGuard } from "@/features/auth/auth-guard";
import { ChannelClosedView } from "@/features/channels/channel-closed-view";
import { ChannelDashboardTabs } from "@/features/channels/channel-dashboard-tabs";
import { ChannelClosedError, getChannelState } from "@/lib/api";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ChannelPage({ params }: Props) {
  const { id } = await params;
  const cookieHeader = (await headers()).get("cookie");

  let data: Awaited<ReturnType<typeof getChannelState>>;
  try {
    data = await getChannelState(id, { cookieHeader });
  } catch (e) {
    if (e instanceof ChannelClosedError) {
      return (
        <AuthGuard>
          <ChannelClosedView />
        </AuthGuard>
      );
    }
    throw e;
  }

  const startedAt = data?.playback?.started_at_server_time;
  const pausedAt = data?.playback?.paused_at_position;
  const trackPath = data?.playback?.track?.file ?? undefined;
  const isPlaying = data?.playback?.is_playing ?? false;
  const channelIsActive = data.channel.is_active !== false;
  const initialExperience =
    data.channel.experience && typeof data.channel.experience === "object"
      ? (data.channel.experience as Record<string, unknown>)
      : null;
  const brandLogoUrl = data.channel.brand_logo_url ?? null;

  return (
    <AuthGuard>
      <ChannelDashboardTabs
        channelId={id}
        channelOwnerId={data?.channel?.owner}
        channelName={data?.channel?.name ?? `Channel #${id}`}
        channelPrivacy={data?.channel?.privacy ?? "unknown"}
        channelIsActive={channelIsActive}
        isPlaying={isPlaying}
        trackPath={trackPath}
        startedAt={startedAt ?? undefined}
        pausedAt={pausedAt ?? undefined}
        initialDescription={data?.channel?.description}
        initialMemberLimit={data?.channel?.member_limit ?? 50}
        publicSlug={data?.channel?.public_slug}
        publicJoinSlug={data?.channel?.public_join_slug ?? null}
        initialJoinRequiresApproval={Boolean(data?.channel?.join_requires_approval)}
        initialExperience={initialExperience}
        brandLogoUrl={brandLogoUrl}
      />
    </AuthGuard>
  );
}
