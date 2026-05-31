"use client";

import { Loader2, Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { useTranslations } from "@/shared/providers/locale-provider";
import { CATEGORY_KEYS } from "@/features/support/model/support-ticket-meta";
import { cn } from "@/lib/utils";

export type CreateSupportTicketFormProps = {
  subject: string;
  category: string;
  body: string;
  categories: Array<{ id: string; label: string }>;
  busy?: boolean;
  onSubjectChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onCreate: () => void;
  idPrefix?: string;
  layout?: "default" | "rail";
  hideSubmit?: boolean;
};

export function CreateSupportTicketForm({
  subject,
  category,
  body,
  categories,
  busy = false,
  onSubjectChange,
  onCategoryChange,
  onBodyChange,
  onCreate,
  idPrefix = "support",
  layout = "default",
  hideSubmit = false,
}: CreateSupportTicketFormProps) {
  const { t } = useTranslations();
  const rail = layout === "rail";
  const canSubmit = Boolean(subject.trim() && body.trim());

  return (
    <form
      className={cn("flex flex-col", rail ? "gap-5" : "gap-4")}
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit && !busy) onCreate();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-subject`} className={rail ? "text-xs text-muted-foreground" : undefined}>
          {t("support.subject")}
        </Label>
        <Input
          id={`${idPrefix}-subject`}
          value={subject}
          valid={Boolean(subject.trim())}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder={t("support.subjectPlaceholder")}
          className={rail ? "h-10" : "h-11"}
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-category`} className={rail ? "text-xs text-muted-foreground" : undefined}>
          {t("support.category")}
        </Label>
        <Select
          id={`${idPrefix}-category`}
          className={rail ? "h-10" : "h-11"}
          value={category}
          valid={Boolean(category)}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {CATEGORY_KEYS[c.id] ? t(CATEGORY_KEYS[c.id]) : c.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-body`} className={rail ? "text-xs text-muted-foreground" : undefined}>
          {t("support.messagePlaceholder")}
        </Label>
        <textarea
          id={`${idPrefix}-body`}
          className={cn(
            "w-full resize-y rounded-lg border border-border/90 bg-card/80 px-3 py-2 text-start text-sm text-foreground shadow-inner transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            rail ? "min-h-[6rem]" : "min-h-[7rem]",
          )}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
        />
      </div>

      {hideSubmit ? null : (
      <Button
        type="submit"
        disabled={!canSubmit || busy}
        className={cn(
          "w-full gap-2 bg-brand text-brand-foreground hover:bg-brand-strong",
          rail ? "h-10 rounded-lg" : "h-11",
        )}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
        {t("support.createTicket")}
      </Button>
      )}
    </form>
  );
}
