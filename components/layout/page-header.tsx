import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-bold text-text tab:text-3xl">{title}</h1>
        {description ? <p className="text-secondary">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}
