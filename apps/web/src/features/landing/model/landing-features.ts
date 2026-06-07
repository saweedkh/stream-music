import type { LucideIcon } from "lucide-react";
import {
  Compass,
  ListMusic,
  MessageCircle,
  Radio,
  Smartphone,
  Users,
} from "lucide-react";
import type { MessageKey } from "@/lib/i18n/messages";

export type LandingFeature = {
  id: string;
  icon: LucideIcon;
  titleKey: MessageKey;
  descKey: MessageKey;
};

export const LANDING_FEATURES: LandingFeature[] = [
  {
    id: "sync",
    icon: Radio,
    titleKey: "landing.feat.sync.title",
    descKey: "landing.feat.sync.desc",
  },
  {
    id: "chat",
    icon: MessageCircle,
    titleKey: "landing.feat.chat.title",
    descKey: "landing.feat.chat.desc",
  },
  {
    id: "queue",
    icon: ListMusic,
    titleKey: "landing.feat.queue.title",
    descKey: "landing.feat.queue.desc",
  },
  {
    id: "rooms",
    icon: Users,
    titleKey: "landing.feat.rooms.title",
    descKey: "landing.feat.rooms.desc",
  },
  {
    id: "discover",
    icon: Compass,
    titleKey: "landing.feat.discover.title",
    descKey: "landing.feat.discover.desc",
  },
  {
    id: "everywhere",
    icon: Smartphone,
    titleKey: "landing.feat.everywhere.title",
    descKey: "landing.feat.everywhere.desc",
  },
];
