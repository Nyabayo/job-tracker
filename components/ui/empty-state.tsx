import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ icon: Icon, title, children, action }: { icon: LucideIcon; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-dashed border-border bg-surface px-6 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon aria-hidden="true" className="size-7" />
      </span>
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-xl font-bold text-text">{title}</h2>
        <div className="text-secondary">{children}</div>
      </div>
      {action}
    </div>
  );
}
