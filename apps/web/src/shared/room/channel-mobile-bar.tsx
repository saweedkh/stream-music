"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";
import { cn } from "@/lib/utils";
import { fadeUp } from "@/lib/motion";

type Props = {
  chatUnread: number;
  chatPanel: ReactNode;
  queuePanel: ReactNode;
  onChatOpen?: () => void;
  className?: string;
};

export function ChannelMobileBar({ chatUnread, chatPanel, queuePanel, onChatOpen, className }: Props) {
  return (
    <motion.div
      {...fadeUp}
      transition={{ ...fadeUp.transition, delay: 0.08 }}
      className={cn(
        "fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] z-30 flex justify-center gap-2 px-4 lg:hidden",
        className,
      )}
    >
      <Sheet onOpenChange={(open) => open && onChatOpen?.()}>
        <SheetTrigger asChild>
          <Button type="button" variant="secondary" size="sm" className="relative gap-1.5 shadow-lg shadow-black/10">
            <MessageSquare className="h-4 w-4" />
            Chat
            {chatUnread > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-foreground">
                {chatUnread > 9 ? "9+" : chatUnread}
              </span>
            ) : null}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto border-border bg-card">
          <SheetHeader>
            <SheetTitle>Chat</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{chatPanel}</div>
        </SheetContent>
      </Sheet>

      <Sheet>
        <SheetTrigger asChild>
          <Button type="button" variant="secondary" size="sm" className="gap-1.5 shadow-lg shadow-black/10">
            <Sparkles className="h-4 w-4" />
            Queue
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto border-border bg-card">
          <SheetHeader>
            <SheetTitle>Queue</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{queuePanel}</div>
        </SheetContent>
      </Sheet>
    </motion.div>
  );
}
