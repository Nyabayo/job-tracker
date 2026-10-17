"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Toasts with optional actions (B3 undo, G2 follow-up suggestion). Announced
// through an aria-live region; each stays 5 seconds unless it has to wait
// for a choice.

type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; message: string; tone: "info" | "danger"; actions?: ToastAction[]; duration: number | null };
type ToastInput = { message: string; tone?: "info" | "danger"; actions?: ToastAction[]; duration?: number | null };

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (toast.duration === null) return;
    const timer = setTimeout(() => close.current(), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.duration]);
  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-md flex-wrap items-center gap-2 rounded-[var(--radius-card)] border px-4 py-2 text-sm",
        toast.tone === "danger" ? "border-danger bg-danger-soft text-text" : "border-border bg-panel text-on-panel",
      )}
    >
      <p className="min-w-0 flex-1 py-2">{toast.message}</p>
      {toast.actions?.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={() => {
            a.onClick();
            onClose();
          }}
          className="min-h-11 rounded-[var(--radius-control)] px-3 font-semibold text-accent underline-offset-2 hover:underline"
        >
          {a.label}
        </button>
      ))}
      <button type="button" onClick={onClose} aria-label="Dismiss" className="flex size-11 items-center justify-center rounded-[var(--radius-control)]">
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const push = useCallback((t: ToastInput) => {
    const id = next.current++;
    setToasts((all) => [...all.slice(-2), { id, message: t.message, tone: t.tone ?? "info", actions: t.actions, duration: t.duration === undefined ? 5000 : t.duration }]);
  }, []);
  const remove = (id: number) => setToasts((all) => all.filter((t) => t.id !== id));
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 tab:bottom-6"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
