"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { toast } from "sonner";

import { Toaster } from "@/shared/ui/sonner";
import { localizeMessage } from "@/lib/i18n/localize-message";

type ToastTone = "info" | "error" | "success";

type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const showToast = useCallback((message: string, tone: ToastTone = "info") => {
    const text = localizeMessage(message);
    if (tone === "error") {
      toast.error(text);
      return;
    }
    if (tone === "success") {
      toast.success(text);
      return;
    }
    toast.message(text);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
