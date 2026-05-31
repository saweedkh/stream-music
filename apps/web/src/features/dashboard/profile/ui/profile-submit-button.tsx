"use client";

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";

type ProfileSubmitButtonProps = {
  loading?: boolean;
  disabled?: boolean;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
};

export function ProfileSubmitButton({
  loading,
  disabled,
  children,
  icon,
  className,
}: ProfileSubmitButtonProps) {
  const active = !disabled && !loading;

  return (
    <Button
      type="submit"
      disabled={disabled || loading}
      className={cn(
        "h-10 gap-2 rounded-lg px-6 text-sm font-semibold sm:min-w-[11rem]",
        active && "shadow-md shadow-brand/25 hover:shadow-lg hover:shadow-brand/30",
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </Button>
  );
}
