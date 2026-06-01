"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  Loader2,
  Lock,
  MessageCircle,
  Paperclip,
  User,
  X,
} from "lucide-react";
import { SupportSocketBadge } from "@/features/support/components/support-socket-badge";
import { SupportTicketManagePanel } from "@/features/support/components/support-ticket-manage-panel";
import type { useSupportPage } from "@/features/support/hooks/use-support-page";
import {
  formatFileSize,
  supportAttachmentUrl,
  SUPPORT_ATTACHMENT_ACCEPT,
  validateSupportAttachment,
} from "@/features/support/model/support-attachments";
import { CATEGORY_KEYS, PRIORITY_KEYS, STATUS_KEYS, statusVariant } from "@/features/support/model/support-ticket-meta";
import { ChatInputBar, ChatMessageRow, ChatPanel } from "@/shared/chat";
import { useTranslations } from "@/shared/providers/locale-provider";
import { useToast } from "@/shared/ui/toast-provider";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { UserAvatar } from "@/shared/ui/user-avatar";
import { UsernameWithBadges } from "@/shared/ui/user-verified-badge";
import type { SupportMessageRow, SupportTicketRow } from "@/lib/api";
import { cn } from "@/lib/utils";

type StaffChatState = Pick<
  ReturnType<typeof useSupportPage>,
  | "ticket"
  | "messages"
  | "loadingChat"
  | "chatSocketState"
  | "compose"
  | "pendingFile"
  | "sending"
  | "patching"
  | "internalNote"
  | "staffUsers"
  | "categories"
  | "setCompose"
  | "setPendingFile"
  | "setInternalNote"
  | "sendReply"
  | "backToList"
  | "patchTicketFields"
>;

function MessageAttachment({ message }: { message: SupportMessageRow }) {
  const att = message.attachment;
  if (!att) return null;
  const href = supportAttachmentUrl(att.url);
  const isImage = att.content_type.startsWith("image/");

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 px-2 py-1.5 text-xs transition-colors hover:bg-muted/40"
    >
      {isImage ? <ImageIcon className="size-3.5 shrink-0 text-brand" aria-hidden /> : <FileText className="size-3.5 shrink-0 text-brand" aria-hidden />}
      <span className="min-w-0 truncate">{att.name}</span>
      <span className="shrink-0 opacity-70">{formatFileSize(att.size)}</span>
    </a>
  );
}

function StaffTicketHeader({
  ticket,
  socketState,
  onBack,
}: {
  ticket: SupportTicketRow;
  socketState: StaffChatState["chatSocketState"];
  onBack: () => void;
}) {
  const { t } = useTranslations();
  const requester = ticket.requester_username ?? ticket.requester?.username ?? "?";

  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
      <Button type="button" size="icon" variant="ghost" className="size-9 shrink-0" onClick={onBack} aria-label={t("support.backToList")}>
        <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
      </Button>
      <UserAvatar username={requester} avatarUrl={ticket.requester?.avatar_url} className="size-10 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="line-clamp-1 text-sm font-semibold sm:text-base">{ticket.subject}</h2>
          <SupportSocketBadge state={socketState} />
          <span className="font-mono text-[10px] text-muted-foreground">{ticket.reference}</span>
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="size-3.5 shrink-0" aria-hidden />
          {t("support.requester")}: <span className="font-medium text-foreground">@{requester}</span>
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant={statusVariant(ticket.status)} className="h-5 px-2 text-[10px]">
            {t(STATUS_KEYS[ticket.status])}
          </Badge>
          <Badge variant="secondary" className="h-5 px-2 text-[10px]">
            {t(PRIORITY_KEYS[ticket.priority])}
          </Badge>
          {CATEGORY_KEYS[ticket.category] ? (
            <Badge variant="secondary" className="h-5 px-2 text-[10px] font-normal">
              {t(CATEGORY_KEYS[ticket.category])}
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SupportStaffChatView({ state }: { state: StaffChatState }) {
  const { t } = useTranslations();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const {
    ticket,
    messages,
    loadingChat,
    chatSocketState,
    compose,
    pendingFile,
    sending,
    patching,
    internalNote,
    staffUsers,
    categories,
    setCompose,
    setPendingFile,
    setInternalNote,
    sendReply,
    backToList,
    patchTicketFields,
  } = state;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loadingChat]);

  if (!ticket) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  const closed = ticket.status === "closed";

  function onPickFile(file: File | null) {
    if (!file) return;
    const err = validateSupportAttachment(file);
    if (err === "too_large") {
      showToast(t("support.attachmentTooLarge"), "error");
      return;
    }
    if (err) {
      showToast(t("support.attachmentInvalidType"), "error");
      return;
    }
    setPendingFile(file);
  }

  function formatTime(iso: string | null): string {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="sr-only"
        accept={SUPPORT_ATTACHMENT_ACCEPT}
        onChange={(e) => {
          onPickFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ChatPanel
            fullHeight
            scrollEndRef={messagesEndRef}
            header={<StaffTicketHeader ticket={ticket} socketState={chatSocketState} onBack={backToList} />}
            footer={
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-foreground">{t("support.internalNote")}</p>
                    <p className="text-[11px] text-muted-foreground">{t("support.internalNoteHint")}</p>
                  </div>
                  <Switch checked={internalNote} onCheckedChange={setInternalNote} disabled={closed} aria-label={t("support.internalNote")} />
                </div>
                <ChatInputBar
                  value={compose}
                  onChange={setCompose}
                  onSend={() => void sendReply()}
                  sending={sending}
                  disabled={closed}
                  placeholder={internalNote ? t("support.internalReplyPlaceholder") : t("support.replyPlaceholder")}
                  sendLabel={t("support.send")}
                  hint={closed ? undefined : t("support.attachmentHint")}
                  closedBanner={
                    closed ? (
                      <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                        <Lock className="size-4 shrink-0 opacity-60" aria-hidden />
                        {t("support.ticketClosed")}
                      </div>
                    ) : undefined
                  }
                  topSlot={
                    pendingFile ? (
                      <div className="mb-2 flex items-center gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2 text-xs">
                        <Paperclip className="size-3.5 shrink-0 text-brand" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{pendingFile.name}</span>
                        <span className="text-muted-foreground">{formatFileSize(pendingFile.size)}</span>
                        <button type="button" className="flex size-6 items-center justify-center rounded-md hover:bg-muted/60" onClick={() => setPendingFile(null)} aria-label={t("support.removeAttachment")}>
                          <X className="size-3.5" aria-hidden />
                        </button>
                      </div>
                    ) : undefined
                  }
                  leading={
                    closed ? undefined : (
                      <Button type="button" size="icon" variant="outline" className="size-10 shrink-0" onClick={() => fileInputRef.current?.click()} aria-label={t("support.attachFile")}>
                        <Paperclip className="size-4" aria-hidden />
                      </Button>
                    )
                  }
                  allowEmptySend={Boolean(pendingFile)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!closed && (compose.trim() || pendingFile) && !sending) void sendReply();
                    }
                  }}
                />
              </div>
            }
          >
            {loadingChat ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-8 animate-spin text-brand/60" aria-hidden />
                <span>{t("support.loadingMessages")}</span>
              </div>
            ) : messages.length === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">{t("support.noMessages")}</p>
            ) : (
              messages.map((m) => {
                const mine = m.is_mine && !m.is_internal;
                const staff = Boolean(m.author?.is_staff || m.author?.is_superuser);

                return (
                  <ChatMessageRow
                    key={m.id}
                    mine={mine}
                    username={m.author?.username}
                    authorFlags={m.author}
                    timeLabel={formatTime(m.created_at)}
                    className={cn(m.is_internal && "opacity-90")}
                    authorLine={
                      m.is_internal ? (
                        <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
                          {t("support.internal")}
                        </span>
                      ) : staff ? (
                        <span className="flex flex-wrap items-center gap-2">
                          <UsernameWithBadges username={m.author?.username ?? "?"} flags={m.author} prefix="" size="xs" usernameClassName="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground" />
                          <span className="rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-brand">{t("support.responder")}</span>
                        </span>
                      ) : undefined
                    }
                  >
                    {m.body ? <p className="whitespace-pre-wrap break-words leading-relaxed">{m.body}</p> : null}
                    {m.attachment ? <MessageAttachment message={m} /> : null}
                  </ChatMessageRow>
                );
              })
            )}
          </ChatPanel>
        </div>

        <aside className="hidden w-full shrink-0 border-s border-border/70 bg-muted/10 lg:block lg:w-80 xl:w-96">
          <div className="sticky top-0 max-h-full overflow-y-auto p-4">
            <SupportTicketManagePanel
              ticket={ticket}
              categories={categories}
              staffUsers={staffUsers}
              patching={patching}
              onPatch={patchTicketFields}
            />
          </div>
        </aside>

        <div className="border-t border-border/70 p-3 lg:hidden">
          <Button type="button" variant="outline" className="w-full" onClick={() => setManageOpen((v) => !v)}>
            <MessageCircle className="size-4" aria-hidden />
            {t("support.manageTicket")}
          </Button>
          {manageOpen ? (
            <div className="mt-3">
              <SupportTicketManagePanel
                ticket={ticket}
                categories={categories}
                staffUsers={staffUsers}
                patching={patching}
                onPatch={patchTicketFields}
              />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
