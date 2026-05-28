import type { Metadata } from "next";
import Link from "next/link";
import { getPartyRecap } from "@/lib/api";
import { PartyRecapClient } from "./party-recap-client";

type Props = { params: Promise<{ channelId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { channelId } = await params;
  try {
    const recap = await getPartyRecap(channelId);
    const title = `${recap.channel_name} — Party recap`;
    const description =
      recap.description?.trim() ||
      `Top tracks and listener energy from ${recap.channel_name}.`;
    const top = recap.top_tracks?.[0];
    const extra = top ? ` Now playing highlight: ${top.title}.` : "";
    return {
      title,
      description: `${description}${extra}`,
      openGraph: {
        title,
        description,
        type: "website",
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
    };
  } catch {
    return { title: "Party recap" };
  }
}

export default async function PartyRecapPage({ params }: Props) {
  const { channelId } = await params;
  let recap: Awaited<ReturnType<typeof getPartyRecap>> | null = null;
  try {
    recap = await getPartyRecap(channelId);
  } catch {
    recap = null;
  }

  if (!recap) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h1 className="text-xl font-semibold text-foreground">Party recap unavailable</h1>
        <p className="text-sm text-muted-foreground">This room may be private or has no playback history yet.</p>
        <Link href="/" className="text-brand hover:underline">
          Home
        </Link>
      </div>
    );
  }

  return <PartyRecapClient recap={recap} channelId={channelId} />;
}
